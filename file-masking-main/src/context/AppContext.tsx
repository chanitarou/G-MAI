import { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import { NgWord, UploadedFile, Detection, ParseError, Category } from '../types';
import * as ngWordService from '../services/ngWordService';

interface AppContextType {
  ngWords: NgWord[];
  ngWordsLoading: boolean;
  ngWordsError: string | null;
  loadNgWords: () => Promise<void>;
  addNgWord: (word: string, category: Category) => Promise<void>;
  updateNgWord: (id: string, word: string, category: Category) => Promise<void>;
  removeNgWord: (id: string) => Promise<void>;
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

  useEffect(() => {
    loadNgWords();
  }, [loadNgWords]);

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
