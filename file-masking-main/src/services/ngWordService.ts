import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { NgWord, Category } from '../types';
import { defaultNgWords } from '../data/defaultNgWords';

// ローカルストレージのキー
const LOCAL_STORAGE_KEY = 'ng_words';

// ローカルストレージから取得
const getLocalNgWords = (): NgWord[] => {
  const stored = localStorage.getItem(LOCAL_STORAGE_KEY);
  if (stored) {
    return JSON.parse(stored);
  }
  // 初回はデフォルトデータを保存
  localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(defaultNgWords));
  return defaultNgWords;
};

// ローカルストレージに保存
const saveLocalNgWords = (words: NgWord[]): void => {
  localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(words));
};

// 全NGワード取得
export const fetchNgWords = async (): Promise<NgWord[]> => {
  if (!isSupabaseConfigured()) {
    return getLocalNgWords();
  }

  const { data, error } = await supabase!
    .from('ng_words')
    .select('id, word, category')
    .order('category', { ascending: true })
    .order('word', { ascending: true });

  if (error) {
    console.error('Error fetching ng_words:', error);
    throw error;
  }

  return data as NgWord[];
};

// NGワード追加
export const addNgWord = async (word: string, category: Category): Promise<NgWord> => {
  if (!isSupabaseConfigured()) {
    const words = getLocalNgWords();
    const newWord: NgWord = {
      id: `local-${Date.now()}-${Math.random()}`,
      word,
      category,
    };
    words.push(newWord);
    saveLocalNgWords(words);
    return newWord;
  }

  const { data, error } = await supabase!
    .from('ng_words')
    .insert({ word, category })
    .select('id, word, category')
    .single();

  if (error) {
    console.error('Error adding ng_word:', error);
    throw error;
  }

  return data as NgWord;
};

// NGワード更新
export const updateNgWord = async (
  id: string,
  word: string,
  category: Category
): Promise<NgWord> => {
  if (!isSupabaseConfigured()) {
    const words = getLocalNgWords();
    const index = words.findIndex((w) => w.id === id);
    if (index !== -1) {
      words[index] = { ...words[index], word, category };
      saveLocalNgWords(words);
      return words[index];
    }
    throw new Error('Word not found');
  }

  // 更新を実行し、更新されたデータを取得（IDはUUID型なので文字列のまま渡す）
  const { data, error: updateError, count } = await supabase!
    .from('ng_words')
    .update({ word, category })
    .eq('id', id)
    .select('id, word, category');

  if (updateError) {
    console.error('Error updating ng_word:', updateError);
    throw updateError;
  }

  // 更新された行がない場合（RLSでブロックされた可能性）
  if (!data || data.length === 0) {
    console.error('No rows updated. Check RLS policies. count:', count);
    throw new Error('更新に失敗しました。権限がない可能性があります。');
  }

  return data[0] as NgWord;
};

// NGワード削除
export const deleteNgWord = async (id: string): Promise<void> => {
  if (!isSupabaseConfigured()) {
    const words = getLocalNgWords();
    const filtered = words.filter((w) => w.id !== id);
    saveLocalNgWords(filtered);
    return;
  }

  // 削除を実行し、削除されたデータを取得（IDはUUID型なので文字列のまま渡す）
  const { data, error } = await supabase!
    .from('ng_words')
    .delete()
    .eq('id', id)
    .select('id');

  if (error) {
    console.error('Error deleting ng_word:', error);
    throw error;
  }

  // 削除された行がない場合（RLSでブロックされた可能性）
  if (!data || data.length === 0) {
    console.error('No rows deleted. Check RLS policies.');
    throw new Error('削除に失敗しました。権限がない可能性があります。');
  }
};
