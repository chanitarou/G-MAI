/**
 * Dify API Service
 * Handles API calls to Dify for dataset metadata management
 */

const DIFY_API_BASE_URL = import.meta.env.VITE_DIFY_API_BASE_URL || 'https://api.dify.ai/v1';
const DIFY_DATASET_ID = import.meta.env.VITE_DIFY_DATASET_ID || '';
const DIFY_API_KEY = import.meta.env.VITE_DIFY_API_KEY || '';
const DIFY_CHAT_API_KEY = import.meta.env.VITE_DIFY_CHAT_API_KEY || '';
const DIFY_CHAT_USER = import.meta.env.VITE_DIFY_CHAT_USER || 'default-user';

export interface DifyTagMetadata {
  type: string;
  name: string;
}

export interface DifyMetadataField {
  id: string;
  name: string;
  type: string;
}

export interface DifyMetadataResponse {
  doc_metadata: DifyMetadataField[];
  built_in_field_enabled: boolean;
}

export interface DifyApiError {
  message: string;
  status?: number;
}

export interface DifyDocumentMetadata {
  id: string;
  name: string;
  type: string;
  value: string | null;
}

export interface DifyDataSourceInfo {
  real_file_id: string;
  name: string;
  size: number;
  extension: string;
  mime_type: string;
  url: string;
  transfer_method: string;
}

export interface DifyDocument {
  id: string;
  position: number;
  data_source_type: string;
  data_source_info: DifyDataSourceInfo;
  name: string;
  created_from: string;
  created_by: string;
  created_at: number;
  tokens: number;
  indexing_status: string;
  error: string | null;
  enabled: boolean;
  disabled_at: number | null;
  disabled_by: string | null;
  archived: boolean;
  display_status: string;
  word_count: number;
  hit_count: number;
  doc_form: string;
  doc_metadata: DifyDocumentMetadata[] | null;
}

export interface DifyDocumentsResponse {
  data: DifyDocument[];
  has_more: boolean;
  limit: number;
  total: number;
  page: number;
}

export interface DifyUpdateDocumentMetadataPayload {
  doc_metadata: {
    [key: string]: string;
  };
}

export interface DifyChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

export interface DifyChatRequest {
  inputs: Record<string, any>;
  query: string;
  response_mode: 'blocking' | 'streaming';
  conversation_id?: string;
  user: string;
  files?: Array<{
    type: string;
    transfer_method: string;
    url: string;
  }>;
}

export interface DifyChatResponse {
  event: string;
  message_id: string;
  conversation_id: string;
  mode: string;
  answer: string;
  metadata: {
    usage: {
      prompt_tokens: number;
      prompt_unit_price: string;
      prompt_price_unit: string;
      prompt_price: string;
      completion_tokens: number;
      completion_unit_price: string;
      completion_price_unit: string;
      completion_price: string;
      total_tokens: number;
      total_price: string;
      currency: string;
      latency: number;
    };
    retriever_resources: Array<{
      position: number;
      dataset_id: string;
      dataset_name: string;
      document_id: string;
      document_name: string;
      segment_id: string;
      score: number;
      content: string;
    }>;
  };
  created_at: number;
}

export interface DifySearchResultItem {
  document_name: string;
  title: string;
  summary: string;
  relevance_score: 'high' | 'medium' | 'low';
  key_points?: string[];
  category?: string;
  date?: string;
  client?: string;
}

export interface DifySearchResponse {
  status: 'success' | 'no_results' | 'partial';
  total_count: number;
  results: DifySearchResultItem[];
  suggestion_message?: string;
}

export interface DifyEnhancedChatResponse extends DifyChatResponse {
  search_response?: DifySearchResponse;
}

/**
 * Creates a new tag in Dify dataset metadata
 * @param tagName - The name of the tag to create
 * @returns Promise that resolves when tag is created
 * @throws DifyApiError if the API call fails
 */
export async function createDifyTag(tagName: string): Promise<void> {
  if (!DIFY_API_KEY) {
    throw new Error('Dify API key is not configured. Please set VITE_DIFY_API_KEY in your .env file.');
  }

  if (!DIFY_DATASET_ID) {
    throw new Error('Dify dataset ID is not configured. Please set VITE_DIFY_DATASET_ID in your .env file.');
  }

  const url = `${DIFY_API_BASE_URL}/datasets/${DIFY_DATASET_ID}/metadata`;

  const payload: DifyTagMetadata = {
    type: 'string',
    name: tagName,
  };

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${DIFY_API_KEY}`,
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const errorText = await response.text();
      let errorMessage = `Failed to create tag in Dify: ${response.statusText}`;

      try {
        const errorJson = JSON.parse(errorText);
        errorMessage = errorJson.message || errorMessage;
      } catch {
        // If error is not JSON, use the text or default message
        errorMessage = errorText || errorMessage;
      }

      throw {
        message: errorMessage,
        status: response.status,
      } as DifyApiError;
    }

    // Success - API returned 200/201
    return;
  } catch (error) {
    if ((error as DifyApiError).message) {
      throw error;
    }

    // Network or other errors
    throw {
      message: error instanceof Error ? error.message : 'An unknown error occurred',
    } as DifyApiError;
  }
}

/**
 * Fetches all tags (metadata fields) from Dify dataset
 * @returns Promise that resolves with array of metadata fields
 * @throws DifyApiError if the API call fails
 */
export async function fetchDifyTags(): Promise<DifyMetadataField[]> {
  if (!DIFY_API_KEY) {
    throw new Error('Dify API key is not configured. Please set VITE_DIFY_API_KEY in your .env file.');
  }

  if (!DIFY_DATASET_ID) {
    throw new Error('Dify dataset ID is not configured. Please set VITE_DIFY_DATASET_ID in your .env file.');
  }

  const url = `${DIFY_API_BASE_URL}/datasets/${DIFY_DATASET_ID}/metadata`;

  try {
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${DIFY_API_KEY}`,
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      let errorMessage = `Failed to fetch tags from Dify: ${response.statusText}`;

      try {
        const errorJson = JSON.parse(errorText);
        errorMessage = errorJson.message || errorMessage;
      } catch {
        errorMessage = errorText || errorMessage;
      }

      throw {
        message: errorMessage,
        status: response.status,
      } as DifyApiError;
    }

    const data: DifyMetadataResponse = await response.json();
    console.log('Dify API Response:', data);

    // Return the doc_metadata array
    return data.doc_metadata || [];
  } catch (error) {
    if ((error as DifyApiError).message) {
      throw error;
    }

    // Network or other errors
    console.error('Error fetching tags from Dify:', error);
    throw {
      message: error instanceof Error ? error.message : 'An unknown error occurred',
    } as DifyApiError;
  }
}

/**
 * Fetches all documents from Dify dataset
 * @param page - Page number (default: 1)
 * @param limit - Number of documents per page (default: 100)
 * @returns Promise that resolves with documents response
 * @throws DifyApiError if the API call fails
 */
export async function fetchDifyDocuments(page: number = 1, limit: number = 100): Promise<DifyDocumentsResponse> {
  if (!DIFY_API_KEY) {
    throw new Error('Dify API key is not configured. Please set VITE_DIFY_API_KEY in your .env file.');
  }

  if (!DIFY_DATASET_ID) {
    throw new Error('Dify dataset ID is not configured. Please set VITE_DIFY_DATASET_ID in your .env file.');
  }

  const url = `${DIFY_API_BASE_URL}/datasets/${DIFY_DATASET_ID}/documents?page=${page}&limit=${limit}`;

  try {
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${DIFY_API_KEY}`,
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      let errorMessage = `Failed to fetch documents from Dify: ${response.statusText}`;

      try {
        const errorJson = JSON.parse(errorText);
        errorMessage = errorJson.message || errorMessage;
      } catch {
        errorMessage = errorText || errorMessage;
      }

      throw {
        message: errorMessage,
        status: response.status,
      } as DifyApiError;
    }

    const data: DifyDocumentsResponse = await response.json();
    console.log('Dify Documents Response:', data);

    return data;
  } catch (error) {
    if ((error as DifyApiError).message) {
      throw error;
    }

    // Network or other errors
    console.error('Error fetching documents from Dify:', error);
    throw {
      message: error instanceof Error ? error.message : 'An unknown error occurred',
    } as DifyApiError;
  }
}

/**
 * Updates document metadata (tags) in Dify
 * @param documentId - The ID of the document to update
 * @param tags - Array of tag names to assign to the document
 * @returns Promise that resolves when metadata is updated
 * @throws DifyApiError if the API call fails
 */
export async function updateDocumentMetadata(documentId: string, tags: string[]): Promise<void> {
  if (!DIFY_API_KEY) {
    throw new Error('Dify API key is not configured. Please set VITE_DIFY_API_KEY in your .env file.');
  }

  if (!DIFY_DATASET_ID) {
    throw new Error('Dify dataset ID is not configured. Please set VITE_DIFY_DATASET_ID in your .env file.');
  }

  console.log('=== Updating document metadata ===');
  console.log('API Base URL:', DIFY_API_BASE_URL);
  console.log('Dataset ID:', DIFY_DATASET_ID);
  console.log('Document ID:', documentId);
  console.log('Tags to set:', tags);
  console.log('API Key (first 10 chars):', DIFY_API_KEY.substring(0, 10) + '...');

  try {
    // Step 1: Fetch all metadata fields from the dataset
    console.log('Step 1: Fetching all metadata fields...');
    const metadataFields = await fetchDifyTags();
    console.log('Metadata fields:', metadataFields);

    // Step 2: Build metadata list for the document
    // Include ALL metadata field IDs, set value for tags to keep, empty string for tags to remove
    const metadataList = metadataFields.map(field => {
      const shouldKeep = tags.includes(field.name);
      return {
        id: field.id,
        name: field.name,
        value: shouldKeep ? field.name : '',
      };
    });

    console.log('Metadata list to send:', metadataList);

    // Step 3: Update document metadata using batch endpoint
    const url = `${DIFY_API_BASE_URL}/datasets/${DIFY_DATASET_ID}/documents/metadata`;

    const payload = {
      operation_data: [
        {
          document_id: documentId,
          metadata_list: metadataList,
        },
      ],
    };

    console.log('Full URL:', url);
    console.log('Payload:', JSON.stringify(payload, null, 2));
    console.log('Sending POST request...');

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${DIFY_API_KEY}`,
      },
      body: JSON.stringify(payload),
    });

    console.log('Response received. Status:', response.status);
    console.log('Response status text:', response.statusText);
    console.log('Response headers:', Array.from(response.headers.entries()));

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Error response body:', errorText);
      let errorMessage = `Failed to update document metadata in Dify: ${response.statusText}`;

      try {
        const errorJson = JSON.parse(errorText);
        console.error('Parsed error JSON:', errorJson);
        errorMessage = errorJson.message || errorMessage;
      } catch {
        console.error('Could not parse error response as JSON');
        errorMessage = errorText || errorMessage;
      }

      throw {
        message: errorMessage,
        status: response.status,
      } as DifyApiError;
    }

    const responseBody = await response.text();
    console.log('Success response body:', responseBody);
    console.log('Document metadata updated successfully');
    // Success
    return;
  } catch (error) {
    console.error('=== Error in updateDocumentMetadata ===');
    console.error('Error type:', error?.constructor?.name);
    console.error('Error message:', error instanceof Error ? error.message : String(error));
    console.error('Full error object:', error);

    if ((error as DifyApiError).message) {
      throw error;
    }

    // Network errors (like CORS, connection refused, etc.)
    if (error instanceof TypeError) {
      console.error('TypeError detected - likely a network/CORS issue');
      throw {
        message: `ネットワークエラー: ${error.message}. API への接続を確認してください。CORSエラーの可能性があります。`,
      } as DifyApiError;
    }

    throw {
      message: error instanceof Error ? error.message : 'An unknown error occurred',
    } as DifyApiError;
  }
}

/**
 * Upload document response interface
 */
export interface DifyUploadDocumentResponse {
  document: {
    id: string;
    position: number;
    data_source_type: string;
    data_source_info: {
      upload_file_id: string;
    };
    dataset_process_rule_id: string;
    name: string;
    created_from: string;
    created_by: string;
    created_at: number;
    tokens: number;
    indexing_status: string;
    error: string | null;
    enabled: boolean;
    disabled_at: number | null;
    disabled_by: string | null;
    archived: boolean;
    display_status: string;
    word_count: number;
    hit_count: number;
    doc_form: string;
  };
  batch: string;
}

/**
 * Uploads a file to Dify dataset
 * @param file - The file to upload
 * @returns Promise that resolves with the upload response
 * @throws DifyApiError if the API call fails
 */
export async function uploadDocumentToDataset(file: File): Promise<DifyUploadDocumentResponse> {
  if (!DIFY_API_KEY) {
    throw new Error('Dify API key is not configured. Please set VITE_DIFY_API_KEY in your .env file.');
  }

  if (!DIFY_DATASET_ID) {
    throw new Error('Dify dataset ID is not configured. Please set VITE_DIFY_DATASET_ID in your .env file.');
  }

  const url = `${DIFY_API_BASE_URL}/datasets/${DIFY_DATASET_ID}/document/create-by-file`;

  // Build form data according to Dify API specification
  const formData = new FormData();

  // Add the data parameter with indexing configuration
  // doc_form must match the dataset's doc_form setting (hierarchical_model for parent-child chunking)
  const dataPayload = {
    indexing_technique: 'high_quality',
    doc_form: 'hierarchical_model',
    doc_language: 'Japanese',
    process_rule: {
      mode: 'custom',
      rules: {
        pre_processing_rules: [
          { id: 'remove_extra_spaces', enabled: true },
          { id: 'remove_urls_emails', enabled: false }
        ],
        segmentation: {
          separator: '\n\n',
          max_tokens: 500,
          chunk_overlap: 50
        },
        parent_mode: 'paragraph',
        subchunk_segmentation: {
          separator: '\n',
          max_tokens: 200,
          chunk_overlap: 50
        }
      }
    }
  };
  formData.append('data', JSON.stringify(dataPayload));

  // Add the file
  formData.append('file', file);

  console.log('=== Uploading document to Dify ===');
  console.log('URL:', url);
  console.log('File name:', file.name);
  console.log('File size:', file.size);
  console.log('File type:', file.type);
  console.log('Data payload:', JSON.stringify(dataPayload, null, 2));

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${DIFY_API_KEY}`,
        // Note: Do NOT set Content-Type header for multipart/form-data
        // The browser will automatically set it with the correct boundary
      },
      body: formData,
    });

    console.log('Response status:', response.status);

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Error response:', errorText);
      let errorMessage = `Failed to upload document to Dify: ${response.statusText}`;

      try {
        const errorJson = JSON.parse(errorText);
        errorMessage = errorJson.message || errorMessage;
      } catch {
        errorMessage = errorText || errorMessage;
      }

      throw {
        message: errorMessage,
        status: response.status,
      } as DifyApiError;
    }

    const data: DifyUploadDocumentResponse = await response.json();
    console.log('Upload successful:', data);

    return data;
  } catch (error) {
    console.error('Error uploading document:', error);

    if ((error as DifyApiError).message) {
      throw error;
    }

    // Network errors
    if (error instanceof TypeError) {
      throw {
        message: `ネットワークエラー: ${error.message}. API への接続を確認してください。`,
      } as DifyApiError;
    }

    throw {
      message: error instanceof Error ? error.message : 'An unknown error occurred',
    } as DifyApiError;
  }
}

/**
 * Sends a chat message to Dify chatbot and retrieves the response
 * @param query - The user's query/message
 * @param conversationId - Optional conversation ID to continue an existing conversation
 * @returns Promise that resolves with the chat response
 * @throws DifyApiError if the API call fails
 */
export async function sendChatMessage(query: string, conversationId?: string): Promise<DifyEnhancedChatResponse> {
  if (!DIFY_CHAT_API_KEY) {
    throw new Error('Dify Chat API key is not configured. Please set VITE_DIFY_CHAT_API_KEY in your .env file.');
  }

  const url = `${DIFY_API_BASE_URL}/chat-messages`;

  const payload: DifyChatRequest = {
    inputs: {},
    query: query,
    response_mode: 'blocking',
    user: DIFY_CHAT_USER,
  };

  if (conversationId) {
    payload.conversation_id = conversationId;
  }

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${DIFY_CHAT_API_KEY}`,
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const errorText = await response.text();
      let errorMessage = `Failed to send chat message to Dify: ${response.statusText}`;

      try {
        const errorJson = JSON.parse(errorText);
        errorMessage = errorJson.message || errorMessage;
      } catch {
        errorMessage = errorText || errorMessage;
      }

      throw {
        message: errorMessage,
        status: response.status,
      } as DifyApiError;
    }

    const data: DifyChatResponse = await response.json();
    console.log('Dify Chat Response:', data);

    // Parse search_response from answer if it's a JSON string
    const enhancedData: DifyEnhancedChatResponse = { ...data };

    // Check if answer contains JSON with search results
    if (data.answer) {
      try {
        // Try to parse the answer as JSON
        const parsedAnswer = JSON.parse(data.answer);

        // Check if it has the search response structure
        if (parsedAnswer.status && parsedAnswer.results && Array.isArray(parsedAnswer.results)) {
          enhancedData.search_response = parsedAnswer as DifySearchResponse;
          console.log('Parsed search_response from answer:', enhancedData.search_response);
        }
      } catch (e) {
        // If parsing fails, answer is just plain text, which is fine
        console.log('Answer is not JSON, treating as plain text');
      }
    }

    return enhancedData;
  } catch (error) {
    console.error('Error in sendChatMessage:', error);

    if ((error as DifyApiError).message) {
      throw error;
    }

    // Network errors (like CORS, connection refused, etc.)
    if (error instanceof TypeError && error.message.includes('fetch')) {
      throw {
        message: 'ネットワークエラー: Dify APIに接続できません。CORSの設定またはAPIのURLを確認してください。',
      } as DifyApiError;
    }

    throw {
      message: error instanceof Error ? error.message : 'An unknown error occurred',
    } as DifyApiError;
  }
}
