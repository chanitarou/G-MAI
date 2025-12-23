import { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import { NgWord, UploadedFile, Detection, ParseError, Category, OkWord } from '../types';
import * as ngWordService from '../services/ngWordService';
import * as okWordService from '../services/okWordService';

interface AppContextType {
  ngWords: NgWord[];
  ngWordsLoading: boolean;
  ngWordsError: string | null;
  loadNgWords: () => Promise<void>;
  addNgWord: (word: string, category: Category) => Promise<void>;
  updateNgWord: (id: string, word: string, category: Category) => Promise<void>;
  removeNgWord: (id: string) => Promise<void>;
  okWords: OkWord[];
  okWordsLoading: boolean;
  okWordsError: string | null;
  loadOkWords: () => Promise<void>;
  addOkWord: (word: string, reason: string) => Promise<void>;
  updateOkWord: (id: string, reason: string) => Promise<void>;
  removeOkWord: (id: string) => Promise<void>;
  isWordInNgWords: (word: string) => boolean;
  uploadedFiles: UploadedFile[];
  addFile: (file: UploadedFile) => void;
  removeFile: (id: string) => void;
  clearFiles: () => void;
  detections: Detection[];
  setDetections: (detections: Detection[]) => void;
  parseErrors: ParseError[];
  setParseErrors: (errors: ParseError[]) => void;
  imagePdfs: string[];
  setImagePdfs: (files: string[]) => void;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

export const AppProvider = ({ children }: { children: ReactNode }) => {
  const [ngWords, setNgWords] = useState<NgWord[]>([]);
  const [ngWordsLoading, setNgWordsLoading] = useState(true);
  const [ngWordsError, setNgWordsError] = useState<string | null>(null);
  const [okWords, setOkWords] = useState<OkWord[]>([]);
  const [okWordsLoading, setOkWordsLoading] = useState(true);
  const [okWordsError, setOkWordsError] = useState<string | null>(null);
  const [uploadedFiles, setUploadedFiles] = useState<UploadedFile[]>([]);
  const [detections, setDetections] = useState<Detection[]>([]);
  const [parseErrors, setParseErrors] = useState<ParseError[]>([]);
  const [imagePdfs, setImagePdfs] = useState<string[]>([]);

  const loadNgWords = useCallback(async () => {
    setNgWordsLoading(true);
    setNgWordsError(null);
    try {
      const words = await ngWordService.fetchNgWords();
      setNgWords(words);
    } catch (error) {
      setNgWordsError('NGワードの取得に失敗しました');
      console.error(error);
    } finally {
      setNgWordsLoading(false);
    }
  }, []);

  const loadOkWords = useCallback(async () => {
    console.log('[OKワード] 読み込み開始...');
    setOkWordsLoading(true);
    setOkWordsError(null);
    try {
      const words = await okWordService.fetchOkWords();
      console.log('[OKワード] 読み込み完了:', words);
      console.log('[OKワード] 登録数:', words.length);
      setOkWords(words);
    } catch (error) {
      console.error('[OKワード] 読み込みエラー:', error);
      setOkWordsError('OKワードの取得に失敗しました');
    } finally {
      setOkWordsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadNgWords();
    loadOkWords();
  }, [loadNgWords, loadOkWords]);

  const addNgWord = async (word: string, category: Category) => {
    try {
      const newWord = await ngWordService.addNgWord(word, category);
      setNgWords((prev) => [...prev, newWord]);
    } catch (error) {
      console.error('Failed to add ng word:', error);
      throw error;
    }
  };

  const updateNgWord = async (id: string, word: string, category: Category) => {
    try {
      const updated = await ngWordService.updateNgWord(id, word, category);
      setNgWords((prev) => prev.map((w) => (w.id === id ? updated : w)));
    } catch (error) {
      console.error('Failed to update ng word:', error);
      throw error;
    }
  };

  const removeNgWord = async (id: string) => {
    try {
      await ngWordService.deleteNgWord(id);
      setNgWords((prev) => prev.filter((w) => w.id !== id));
    } catch (error) {
      console.error('Failed to delete ng word:', error);
      throw error;
    }
  };

  const addOkWord = async (word: string, reason: string) => {
    console.log('[OKワード] 追加開始:', { word, reason });
    try {
      const newWord = await okWordService.addOkWord(word, reason);
      console.log('[OKワード] 追加成功:', newWord);
      setOkWords((prev) => {
        const updated = [...prev, newWord];
        console.log('[OKワード] 更新後のリスト:', updated);
        return updated;
      });
    } catch (error) {
      console.error('[OKワード] 追加失敗:', error);
      throw error;
    }
  };

  const updateOkWord = async (id: string, reason: string) => {
    try {
      const updated = await okWordService.updateOkWord(id, reason);
      setOkWords((prev) => prev.map((w) => (w.id === id ? updated : w)));
    } catch (error) {
      console.error('Failed to update ok word:', error);
      throw error;
    }
  };

  const removeOkWord = async (id: string) => {
    try {
      await okWordService.deleteOkWord(id);
      setOkWords((prev) => prev.filter((w) => w.id !== id));
    } catch (error) {
      console.error('Failed to delete ok word:', error);
      throw error;
    }
  };

  // NGワードに存在するかチェック（OKワード登録時のバリデーション用）
  const isWordInNgWords = useCallback((word: string): boolean => {
    return ngWords.some((ng) => ng.word === word);
  }, [ngWords]);

  const addFile = (file: UploadedFile) => {
    setUploadedFiles([...uploadedFiles, file]);
  };

  const removeFile = (id: string) => {
    setUploadedFiles(uploadedFiles.filter(f => f.id !== id));
  };

  const clearFiles = () => {
    setUploadedFiles([]);
  };

  return (
    <AppContext.Provider
      value={{
        ngWords,
        ngWordsLoading,
        ngWordsError,
        loadNgWords,
        addNgWord,
        updateNgWord,
        removeNgWord,
        okWords,
        okWordsLoading,
        okWordsError,
        loadOkWords,
        addOkWord,
        updateOkWord,
        removeOkWord,
        isWordInNgWords,
        uploadedFiles,
        addFile,
        removeFile,
        clearFiles,
        detections,
        setDetections,
        parseErrors,
        setParseErrors,
        imagePdfs,
        setImagePdfs,
      }}
    >
      {children}
    </AppContext.Provider>
  );
};

export const useApp = () => {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error('useApp must be used within AppProvider');
  }
  return context;
};
