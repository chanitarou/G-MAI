import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { OkWord } from '../types';

// ローカルストレージのキー
const LOCAL_STORAGE_KEY = 'ok_words';

// ローカルストレージから取得
const getLocalOkWords = (): OkWord[] => {
  const stored = localStorage.getItem(LOCAL_STORAGE_KEY);
  if (stored) {
    return JSON.parse(stored);
  }
  return [];
};

// ローカルストレージに保存
const saveLocalOkWords = (words: OkWord[]): void => {
  localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(words));
};

// 全OKワード取得
export const fetchOkWords = async (): Promise<OkWord[]> => {
  console.log('[okWordService] fetchOkWords開始');
  console.log('[okWordService] Supabase設定状態:', isSupabaseConfigured());

  if (!isSupabaseConfigured()) {
    console.log('[okWordService] ローカルストレージから取得');
    const localWords = getLocalOkWords();
    console.log('[okWordService] ローカルから取得したOKワード:', localWords);
    return localWords;
  }

  console.log('[okWordService] Supabaseから取得中...');
  const { data, error } = await supabase!
    .from('ok_words')
    .select('id, word, reason, created_at, updated_at')
    .order('word', { ascending: true });

  if (error) {
    console.error('[okWordService] Supabaseエラー:', error);
    throw error;
  }

  console.log('[okWordService] Supabaseから取得したOKワード:', data);
  return data as OkWord[];
};

// OKワード追加
export const addOkWord = async (word: string, reason: string): Promise<OkWord> => {
  console.log('[okWordService] addOkWord開始:', { word, reason });
  console.log('[okWordService] Supabase設定状態:', isSupabaseConfigured());

  if (!isSupabaseConfigured()) {
    console.log('[okWordService] ローカルストレージに追加');
    const words = getLocalOkWords();
    const newWord: OkWord = {
      id: `local-${Date.now()}-${Math.random()}`,
      word,
      reason,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    words.push(newWord);
    saveLocalOkWords(words);
    console.log('[okWordService] ローカルに追加完了:', newWord);
    return newWord;
  }

  console.log('[okWordService] Supabaseに追加中...');
  const { data, error } = await supabase!
    .from('ok_words')
    .insert({ word, reason })
    .select('id, word, reason, created_at, updated_at')
    .single();

  if (error) {
    console.error('[okWordService] Supabase追加エラー:', error);
    throw error;
  }

  console.log('[okWordService] Supabaseに追加完了:', data);
  return data as OkWord;
};

// OKワード更新（reasonのみ編集可能）
export const updateOkWord = async (id: string, reason: string): Promise<OkWord> => {
  if (!isSupabaseConfigured()) {
    const words = getLocalOkWords();
    const index = words.findIndex((w) => w.id === id);
    if (index !== -1) {
      words[index] = {
        ...words[index],
        reason,
        updated_at: new Date().toISOString(),
      };
      saveLocalOkWords(words);
      return words[index];
    }
    throw new Error('Word not found');
  }

  const { data, error } = await supabase!
    .from('ok_words')
    .update({ reason })
    .eq('id', id)
    .select('id, word, reason, created_at, updated_at');

  if (error) {
    console.error('Error updating ok_word:', error);
    throw error;
  }

  if (!data || data.length === 0) {
    console.error('No rows updated. Check RLS policies.');
    throw new Error('更新に失敗しました。権限がない可能性があります。');
  }

  return data[0] as OkWord;
};

// OKワード削除
export const deleteOkWord = async (id: string): Promise<void> => {
  if (!isSupabaseConfigured()) {
    const words = getLocalOkWords();
    const filtered = words.filter((w) => w.id !== id);
    saveLocalOkWords(filtered);
    return;
  }

  const { data, error } = await supabase!
    .from('ok_words')
    .delete()
    .eq('id', id)
    .select('id');

  if (error) {
    console.error('Error deleting ok_word:', error);
    throw error;
  }

  if (!data || data.length === 0) {
    console.error('No rows deleted. Check RLS policies.');
    throw new Error('削除に失敗しました。権限がない可能性があります。');
  }
};

// OKワードの存在チェック
export const checkOkWordExists = async (word: string): Promise<boolean> => {
  if (!isSupabaseConfigured()) {
    const words = getLocalOkWords();
    return words.some((w) => w.word === word);
  }

  const { data, error } = await supabase!
    .from('ok_words')
    .select('id')
    .eq('word', word)
    .maybeSingle();

  if (error) {
    console.error('Error checking ok_word existence:', error);
    throw error;
  }

  return data !== null;
};
