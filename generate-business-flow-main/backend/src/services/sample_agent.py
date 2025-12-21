import operator
import json
from typing import Annotated, Literal, Sequence, TypedDict

from langchain_core.utils.function_calling import convert_to_openai_tool
from langgraph.constants import Send
from langgraph.graph import END, START, StateGraph
from langgraph.pregel import Pregel
from openai import OpenAI
from openai.types.chat import ChatCompletionMessageParam

from src.configs import Settings
from src.custom_logger import setup_logger
from src.models import (
    AgentResult,
    Plan,
    ReflectionResult,
    SearchOutput,
    Subtask,
    ToolResult,
)
from src.prompts import HelpDeskAgentPrompts

MAX_CHALLENGE_COUNT = 3

logger = setup_logger(__file__)


class AgentState(TypedDict):
    question: str
    plan: list[str]
    current_step: int
    subtask_results: Annotated[Sequence[Subtask], operator.add]
    last_answer: str


class AgentSubGraphState(TypedDict):
    question: str
    plan: list[str]
    subtask: str
    is_completed: bool
    messages: list[ChatCompletionMessageParam]
    challenge_count: int
    tool_results: Annotated[Sequence[Sequence[SearchOutput]], operator.add]
    reflection_results: Annotated[Sequence[ReflectionResult], operator.add]
    subtask_answer: str


class HelpDeskAgent:
    def __init__(
        self,
        settings: Settings,
        tools: list = [],
        prompts: HelpDeskAgentPrompts = HelpDeskAgentPrompts(),
    ) -> None:
        self.settings = settings
        self.tools = tools
        self.tool_map = {tool.name: tool for tool in tools}
        self.prompts = prompts
        self.client = OpenAI(api_key=self.settings.openai_api_key)

    def create_plan(self, state: AgentState) -> dict:
        """計画を作成する

        Args:
            state (AgentState): 入力の状態

        Returns:
            AgentState: 更新された状態
        """

        logger.info("🚀 Starting plan generation process...")

        # tool定義を渡しシステムプロンプトを生成
        system_prompt = self.prompts.planner_system_prompt

        # ユーザーの質問を渡しユーザープロンプトを生成
        user_prompt = self.prompts.planner_user_prompt.format(
            question=state["question"],
        )
        messages = [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_prompt},
        ]
        # logger.info(f"Final prompt messages: {messages}", json.dumps(messages, indent=2, ensure_ascii=False))
        logger.info(
            "INFO Final prompt messages:\n%s",
            json.dumps(messages, indent=2, ensure_ascii=False)
        )


        # OpenAIにリクエストを送信
        try:
            logger.info("Sending request to OpenAI...")
            response = self.client.beta.chat.completions.parse(
                model=self.settings.openai_model,
                messages=messages,
                response_format=Plan,
                temperature=0,
                seed=0,
            )
            logger.info("✅ Successfully received response from OpenAI.")
        except Exception as e:
            logger.error(f"Error during OpenAI request: {e}")
            raise

        # レスポンスからStructured outputを利用しPlanクラスを取得
        plan = response.choices[0].message.parsed

        logger.info("Plan generation complete!")

        # 生成した計画を返し、状態を更新する
        return {"plan": plan.subtasks}

    def select_tools(self, state: AgentSubGraphState) -> dict:
        """ツールを選択する

        Args:
            state (AgentSubGraphState): 入力の状態

        Returns:
            dict: 更新された状態
        """

        logger.info("🚀 Starting tool selection process...")

        # OpenAI対応のtool定義に書き換える
        logger.info("Converting tools for OpenAI format...")
        openai_tools = [convert_to_openai_tool(tool) for tool in self.tools] # メモ：tool群はおおもとのインスタンス化時に注入

        # リトライされたかどうかでプロンプトを切り替える
        if state["challenge_count"] == 0:
            logger.info("Creating user prompt for tool selection...")
            user_prompt = self.prompts.subtask_tool_selection_user_prompt.format(
                # メモ：プロンプトを組み立てるときのインターフェースはこれ
                question=state["question"], # おおもとの質問も渡している！
                plan=state["plan"], 
                subtask=state["subtask"],
            )

            messages = [
                {"role": "system", "content": self.prompts.subtask_system_prompt},
                {"role": "user", "content": user_prompt},
                # user_prompt
                    # SUBTASK_TOOL_EXECUTION_USER_PROMPT = """
                    # ユーザーの元の質問: {question}
                    # 回答のための計画: {plan}
                    # サブタスク: {subtask}

                    # サブタスク実行を開始します。
                    # 1.ツール選択・実行, 2サブタスク回答を実行してください
                    # """

                # SUBTASK_SYSTEM_PROMPT = """
                #     あなたはXYZというシステムの質問応答のためにサブタスク実行を担当するエージェントです。
                #     回答までの全体の流れは計画立案 → サブタスク実行 [ツール実行 → サブタスク回答 → リフレクション] → 最終回答となります。
                #     サブタスクはユーザーの質問に回答するために考えられた計画の一つです。
                #     最終的な回答は全てのサブタスクの結果を組み合わせて別エージェントが作成します。
                #     あなたは以下の1~3のステップを指示に従ってそれぞれ実行します。各ステップは指示があったら実行し、同時に複数ステップの実行は行わないでください。
                #     なおリフレクションの結果次第で所定の回数までツール選択・実行を繰り返します。

                #     1. ツール選択・実行
                #     サブタスク回答のためのツール選択と選択されたツールの実行を行います。
                #     2回目以降はリフレクションのアドバイスに従って再実行してください。

                #     2. サブタスク回答
                #     ツールの実行結果はあなたしか観測できません。
                #     ツールの実行結果から得られた回答に必要なことは言語化し、最後の回答用エージェントに引き継げるようにしてください。
                #     例えば、概要を知るサブタスクならば、ツールの実行結果から概要を言語化してください。
                #     手順を知るサブタスクならば、ツールの実行結果から手順を言語化してください。
                #     回答できなかった場合は、その旨を言語化してください。

                #     3. リフレクション
                #     ツールの実行結果と回答から、サブタスクに対して正しく回答できているかを評価します。
                #     回答がわからない、情報が見つからないといった内容の場合は評価をNGにし、やり直すようにしてください。
                #     評価がNGの場合は、別のツールを試す、別の文言でツールを試すなど、なぜNGなのかとどうしたら改善できるかを考えアドバイスを作成してください。
                #     アドバイスの内容は過去のアドバイスと計画内の他のサブタスクと重複しないようにしてください。
                #     アドバイスの内容をもとにツール選択・実行からやり直します。
                #     評価がOKの場合は、サブタスク回答を終了します。

                #     """
            ]

        else:
            logger.info("Creating user prompt for tool retry...")

            # リトライされた場合は過去の対話情報にプロンプトを追加する
            messages: list = state["messages"]

            # NOTE: トークン数節約のため過去の検索結果は除く
            # roleがtoolまたはtool_callsを持つものは除く
            messages = [message for message in messages if message["role"] != "tool" or "tool_calls" not in message]

            user_retry_prompt = self.prompts.subtask_retry_answer_user_prompt
            user_message = {"role": "user", "content": user_retry_prompt}
            messages.append(user_message)

        try:
            logger.info("Sending request to OpenAI...")
            response = self.client.chat.completions.create(
                model=self.settings.openai_model,
                messages=messages,
                tools=openai_tools,  # type: ignore
                temperature=0,
                seed=0,
            )
            logger.info(response)

            # logger.info("✅ Successfully received response from OpenAI.")
        except Exception as e:
            logger.error(f"Error during OpenAI request: {e}")
            raise

        if response.choices[0].message.tool_calls is None:
            raise ValueError("Tool calls are None")

        ai_message = {
            "role": "assistant",
            "tool_calls": [tool_call.model_dump() for tool_call in response.choices[0].message.tool_calls],
        }

        logger.info("Tool selection complete!")
        messages.append(ai_message)

        # リトライの場合は追加分のメッセージのみを更新する
        return {"messages": messages}

    def execute_tools(self, state: AgentSubGraphState) -> dict:
        """ツールを実行する

        Args:
            state (AgentSubGraphState): 入力の状態

        Raises:
            ValueError: toolがNoneの場合

        Returns:
            dict: 更新された状態
        """

        logger.info("🚀 Starting tool execution process...")
        messages = state["messages"]

        # 最後のメッセージからツールの呼び出しを取得
        tool_calls = messages[-1]["tool_calls"]

        # 最後のメッセージからツールの呼び出しか確認
        if tool_calls is None:
            logger.error("Tool calls are None")
            logger.error(f"Messages: {messages}")
            raise ValueError("Tool calls are None")

        tool_results = []

        for tool_call in tool_calls:
            tool_name = tool_call["function"]["name"]
            tool_args = tool_call["function"]["arguments"]

            tool = self.tool_map[tool_name]
            tool_result: list[SearchOutput] = tool.invoke(tool_args)

            tool_results.append(
                ToolResult(
                    tool_name=tool_name,
                    args=tool_args,
                    results=tool_result,
                )
            )

            messages.append(
                {
                    "role": "tool",
                    "content": str(tool_result),
                    "tool_call_id": tool_call["id"],
                }
            )
        logger.info("Tool execution complete!")
        return {"messages": messages, "tool_results": [tool_results]}

    def create_subtask_answer(self, state: AgentSubGraphState) -> dict:
        """サブタスク回答を作成する

        Args:
            state (AgentSubGraphState): 入力の状態

        Returns:
            dict: 更新された状態
        """

        logger.info("🚀 Starting subtask answer creation process...")
        messages = state["messages"]

        try:
            logger.info("Sending request to OpenAI...")
            response = self.client.chat.completions.create(
                model=self.settings.openai_model,
                messages=messages,
                temperature=0,
                seed=0,
            )
            logger.info("✅ Successfully received response from OpenAI.")
        except Exception as e:
            logger.error(f"Error during OpenAI request: {e}")
            raise

        subtask_answer = response.choices[0].message.content

        ai_message = {"role": "assistant", "content": subtask_answer}
        messages.append(ai_message)

        logger.info("Subtask answer creation complete!")

        return {
            "messages": messages,
            "subtask_answer": subtask_answer,
        }

    def reflect_subtask(self, state: AgentSubGraphState) -> dict:
        """サブタスク回答を内省する

        Args:
            state (AgentSubGraphState): 入力の状態

        Raises:
            ValueError: reflection resultがNoneの場合

        Returns:
            dict: 更新された状態
        """

        logger.info("🚀 Starting reflection process...")
        messages = state["messages"]

        user_prompt = self.prompts.subtask_reflection_user_prompt

        messages.append({"role": "user", "content": user_prompt})

        try:
            logger.info("Sending request to OpenAI...")
            response = self.client.beta.chat.completions.parse( # 構造化したいとき（response_format）
                model=self.settings.openai_model,
                messages=messages,
                response_format=ReflectionResult,
                temperature=0,
                seed=0,
            )
            logger.info("✅ Successfully received response from OpenAI.")
        except Exception as e:
            logger.error(f"Error during OpenAI request: {e}")
            raise

        reflection_result = response.choices[0].message.parsed
        if reflection_result is None:
            raise ValueError("Reflection result is None")

        messages.append(
            {
                "role": "assistant",
                "content": reflection_result.model_dump_json(),
            }
        )

        update_state = {
            "messages": messages,
            "reflection_results": [reflection_result],
            "challenge_count": state["challenge_count"] + 1,
            "is_completed": reflection_result.is_completed,
        }

        if update_state["challenge_count"] >= MAX_CHALLENGE_COUNT and not reflection_result.is_completed:
            update_state["subtask_answer"] = f"{state['subtask']}の回答が見つかりませんでした。"

        logger.info("Reflection complete!")
        return update_state

    def create_answer(self, state: AgentState) -> dict:
        """最終回答を作成する

        Args:
            state (AgentState): 入力の状態

        Returns:
            dict: 更新された状態
        """

        logger.info("🚀 Starting final answer creation process...")
        system_prompt = self.prompts.create_last_answer_system_prompt

        # サブタスク結果のうちタスク内容と回答のみを取得
        subtask_results = [(result.task_name, result.subtask_answer) for result in state["subtask_results"]]
        user_prompt = self.prompts.create_last_answer_user_prompt.format(
            question=state["question"],
            plan=state["plan"],
            subtask_results=str(subtask_results),
        )
        messages = [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_prompt},
        ]

        try:
            logger.info("Sending request to OpenAI...")
            response = self.client.chat.completions.create(
                model=self.settings.openai_model,
                messages=messages,
                temperature=0,
                seed=0,
            )
            logger.info("✅ Successfully received response from OpenAI.")
        except Exception as e:
            logger.error(f"Error during OpenAI request: {e}")
            raise

        logger.info("Final answer creation complete!")

        return {"last_answer": response.choices[0].message.content}

    def _execute_subgraph(self, state: AgentState):
        subgraph = self._create_subgraph()

        dict_input =  {
            "question": state["question"],# 親グラフのquestionをそのまま
            "plan": state["plan"], # 親グラフのplanをそのままもってきた形
            "subtask": state["plan"][state["current_step"]], # ここはplanがどういう更新をしているのかを見る必要があるな
            "current_step": state["current_step"],
            "is_completed": False,
            "challenge_count": 0,
        }

        logger.info(
            "INFO Final prompt messages:\n%s",
            json.dumps(dict_input, indent=2, ensure_ascii=False)
        )

        result = subgraph.invoke(dict_input)
        


        subtask_result = Subtask(
            task_name=result["subtask"],
            tool_results=result["tool_results"],
            reflection_results=result["reflection_results"],
            is_completed=result["is_completed"],
            subtask_answer=result["subtask_answer"],
            challenge_count=result["challenge_count"],
        )

        return {"subtask_results": [subtask_result]}

    def _should_continue_exec_subtasks(self, state: AgentState) -> list:
        return [
            Send(
                "execute_subtasks",
                {
                    "question": state["question"],
                    "plan": state["plan"],
                    "current_step": idx,
                },
            )
            for idx, _ in enumerate(state["plan"])
        ]

    def _should_continue_exec_subtask_flow(self, state: AgentSubGraphState) -> Literal["end", "continue"]:
        if state["is_completed"] or state["challenge_count"] >= MAX_CHALLENGE_COUNT:
            return "end"
        else:
            return "continue"

    def _create_subgraph(self) -> Pregel:
        """サブグラフを作成する

        Returns:
            Pregel: サブグラフ
        """
        workflow = StateGraph(AgentSubGraphState)

        # ツール選択ノードを追加
        workflow.add_node("select_tools", self.select_tools)

        # ツール実行ノードを追加
        workflow.add_node("execute_tools", self.execute_tools)

        # サブタスク回答作成ノードを追加
        workflow.add_node("create_subtask_answer", self.create_subtask_answer)

        # サブタスク内省ノードを追加
        workflow.add_node("reflect_subtask", self.reflect_subtask)

        # ツール選択からスタート
        workflow.add_edge(START, "select_tools")

        # ノード間のエッジを追加
        workflow.add_edge("select_tools", "execute_tools")
        workflow.add_edge("execute_tools", "create_subtask_answer")
        workflow.add_edge("create_subtask_answer", "reflect_subtask")

        # サブタスク内省ノードの結果から繰り返しのためのエッジを追加
        workflow.add_conditional_edges(
            "reflect_subtask",
            self._should_continue_exec_subtask_flow,
            {"continue": "select_tools", "end": END},
        )

        app = workflow.compile()

        return app

    def create_graph(self) -> Pregel:
        """エージェントのメイングラフを作成する

        Returns:
            Pregel: エージェントのメイングラフ
        """
        workflow = StateGraph(AgentState)

        # Add the plan node
        workflow.add_node("create_plan", self.create_plan) # AgentState全体を返してもよいし、追記したい部分のみを描いてもよいらしい

        # Add the execution step
        workflow.add_node("execute_subtasks", self._execute_subgraph)

        workflow.add_node("create_answer", self.create_answer)

        workflow.add_edge(START, "create_plan")

        # From plan we go to agent
        workflow.add_conditional_edges(
            "create_plan",
            self._should_continue_exec_subtasks,
        )

        # From agent, we replan
        workflow.add_edge("execute_subtasks", "create_answer")

        workflow.set_finish_point("create_answer")

        app = workflow.compile()

        return app

    def run_agent(self, question: str) -> AgentResult:
        """エージェントを実行する

        Args:
            question (str): 入力の質問

        Returns:
            AgentResult: エージェントの実行結果
        """

        app = self.create_graph()
        result = app.invoke(
            {
                "question": question, # 問い合わせ内容そのもの（UIに入力されたユーザークエリ）
                "current_step": 0,
            }
        )
        return AgentResult(
            question=question,
            plan=Plan(subtasks=result["plan"]),
            subtasks=result["subtask_results"],
            answer=result["last_answer"],
        )
