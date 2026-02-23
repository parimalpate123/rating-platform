import { useState, useEffect, useRef, useCallback } from 'react';
import {
  BookOpen, Upload, Trash2, Download, RefreshCw,
  FileText, File, CheckCircle, Clock, AlertCircle, Loader,
} from 'lucide-react';
import { knowledgeBaseApi, KBDocument } from '../api/knowledge-base';

// ── Helpers ─────────────────────────────────────────────────────────────────

const formatBytes = (bytes: number) => {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

const STATUS_CONFIG: Record<string, { label: string; color: string; icon: React.ReactNode; hint: string }> = {
  ready: {
    label: 'Ready',
    color: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400',
    icon: <CheckCircle className="h-3 w-3" />,
    hint: 'Text extracted and searchable',
  },
  processing: {
    label: 'Processing',
    color: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400',
    icon: <Loader className="h-3 w-3 animate-spin" />,
    hint: 'Extracting text...',
  },
  pending: {
    label: 'Stored in S3',
    color: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400',
    icon: <Clock className="h-3 w-3" />,
    hint: 'Saved to S3. PDF/Word text extraction requires AWS Textract.',
  },
  error: {
    label: 'Error',
    color: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400',
    icon: <AlertCircle className="h-3 w-3" />,
    hint: 'Processing failed',
  },
};

function FileIcon({ type }: { type: string }) {
  const cls = 'h-9 w-9';
  if (type === 'pdf') return <FileText className={`${cls} text-red-500`} />;
  if (type === 'docx' || type === 'doc') return <FileText className={`${cls} text-blue-500`} />;
  if (type === 'xlsx' || type === 'csv') return <FileText className={`${cls} text-green-500`} />;
  return <File className={`${cls} text-gray-400`} />;
}

// ── Upload queue ─────────────────────────────────────────────────────────────

interface UploadItem {
  id: string;
  file: File;
  progress: number;
  status: 'queued' | 'uploading' | 'done' | 'error';
  error?: string;
}

// ── Page ─────────────────────────────────────────────────────────────────────

export function KnowledgeBase() {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [documents, setDocuments] = useState<KBDocument[]>([]);
  const [loading, setLoading] = useState(true);
  const [queue, setQueue] = useState<UploadItem[]>([]);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [reprocessingId, setReprocessingId] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const docs = await knowledgeBaseApi.getAll();
      setDocuments(docs);
    } catch {
      // silently ignore
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  // Auto-refresh every 5s when any doc is pending/processing
  useEffect(() => {
    const hasActive = documents.some(
      (d) => d.aiStatus === 'pending' || d.aiStatus === 'processing',
    );
    if (!hasActive) return;
    const timer = setInterval(load, 5000);
    return () => clearInterval(timer);
  }, [documents, load]);

  const updateItem = (id: string, patch: Partial<UploadItem>) =>
    setQueue((prev) => prev.map((item) => (item.id === id ? { ...item, ...patch } : item)));

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    if (!files.length) return;

    const newItems: UploadItem[] = files.map((file) => ({
      id: `${file.name}-${Date.now()}-${Math.random()}`,
      file,
      progress: 0,
      status: 'queued',
    }));
    setQueue((prev) => [...prev, ...newItems]);
    if (fileInputRef.current) fileInputRef.current.value = '';

    for (const item of newItems) {
      updateItem(item.id, { status: 'uploading', progress: 0 });
      try {
        await knowledgeBaseApi.upload(
          item.file,
          {},
          (percent) => updateItem(item.id, { progress: percent }),
        );
        updateItem(item.id, { status: 'done', progress: 100 });
      } catch (err: any) {
        const msg = err.response?.data?.message || err.message || 'Upload failed';
        updateItem(item.id, { status: 'error', error: msg });
      }
    }

    await load();
    setTimeout(() => setQueue([]), 4000);
  };

  const handleDownload = async (doc: KBDocument) => {
    try {
      const { url } = await knowledgeBaseApi.getDownloadUrl(doc.id);
      window.open(url, '_blank');
    } catch (err: any) {
      alert('Download failed: ' + err.message);
    }
  };

  const handleDelete = async (doc: KBDocument) => {
    if (!window.confirm(`Delete "${doc.filename}" from Knowledge Base and S3?`)) return;
    setDeletingId(doc.id);
    try {
      await knowledgeBaseApi.delete(doc.id);
      setDocuments((prev) => prev.filter((d) => d.id !== doc.id));
    } catch (err: any) {
      alert('Delete failed: ' + err.message);
    } finally {
      setDeletingId(null);
    }
  };

  const handleReprocess = async (doc: KBDocument) => {
    setReprocessingId(doc.id);
    try {
      const updated = await knowledgeBaseApi.reprocess(doc.id);
      setDocuments((prev) => prev.map((d) => (d.id === updated.id ? updated : d)));
    } catch (err: any) {
      alert('Reprocess failed: ' + err.message);
    } finally {
      setReprocessingId(null);
    }
  };

  const anyUploading = queue.some((q) => q.status === 'uploading' || q.status === 'queued');

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Knowledge Base</h1>
          <p className="text-gray-500 dark:text-gray-400 mt-1 text-sm">
            Upload documents for AI-powered rule generation and Q&amp;A
          </p>
        </div>
        <div>
          <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300 border border-amber-200 dark:border-amber-800 mr-3">
            <Clock className="h-4 w-4" />
            Coming soon
          </span>
        </div>
        <div>
          <input
            ref={fileInputRef}
            type="file"
            multiple
            accept=".pdf,.docx,.doc,.xlsx,.csv,.txt,.md,.json"
            className="hidden"
            onChange={handleFileSelect}
          />
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={anyUploading}
            className="inline-flex items-center gap-2 px-4 py-2 bg-purple-600 hover:bg-purple-700 disabled:opacity-50 text-white text-sm font-medium rounded-lg transition-colors"
          >
            <Upload className="h-4 w-4" />
            <span>{anyUploading ? 'Uploading...' : 'Upload Documents'}</span>
          </button>
        </div>
      </div>

      {/* Upload queue */}
      {queue.length > 0 && (
        <div className="border border-purple-200 dark:border-purple-800 rounded-lg p-4 space-y-3 bg-purple-50 dark:bg-purple-900/10">
          <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300">Upload Progress</h2>
          {queue.map((item) => (
            <div key={item.id}>
              <div className="flex items-center justify-between text-sm mb-1">
                <span className="text-gray-700 dark:text-gray-300 truncate max-w-xs">{item.file.name}</span>
                <span className={`text-xs font-medium ${
                  item.status === 'done' ? 'text-green-600' :
                  item.status === 'error' ? 'text-red-600' :
                  item.status === 'uploading' ? 'text-blue-600' : 'text-gray-400'
                }`}>
                  {item.status === 'queued' && 'Waiting...'}
                  {item.status === 'uploading' && `${item.progress}%`}
                  {item.status === 'done' && 'Uploaded'}
                  {item.status === 'error' && 'Failed'}
                </span>
              </div>
              <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-1.5">
                <div
                  className={`h-1.5 rounded-full transition-all duration-300 ${
                    item.status === 'done' ? 'bg-green-500' :
                    item.status === 'error' ? 'bg-red-500' :
                    item.status === 'uploading' ? 'bg-blue-500' : 'bg-gray-300'
                  }`}
                  style={{ width: `${item.status === 'done' ? 100 : item.progress}%` }}
                />
              </div>
              {item.status === 'error' && (
                <p className="text-xs text-red-600 mt-1">{item.error}</p>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Info banner */}
      <div className="rounded-lg border border-blue-200 dark:border-blue-800 bg-blue-50 dark:bg-blue-900/10 px-4 py-3">
        <div className="flex items-start gap-3">
          <BookOpen className="h-5 w-5 text-blue-600 dark:text-blue-400 mt-0.5 flex-shrink-0" />
          <div className="text-sm text-blue-800 dark:text-blue-300 space-y-1">
            <p className="font-medium">Supported: PDF, Word (.docx), Excel (.xlsx), CSV, Text (.txt), Markdown (.md), JSON</p>
            <p>
              <span className="font-medium">Local (MinIO):</span> Files stored immediately.
              Text auto-extracted for <code>.txt</code> / <code>.md</code> / <code>.csv</code> / <code>.json</code> → status shows <span className="text-green-700 dark:text-green-400 font-medium">Ready</span>.
            </p>
            <p>
              <span className="font-medium">AWS:</span> PDF/Word text extraction via Textract → all files become <span className="text-green-700 dark:text-green-400 font-medium">Ready</span> with full AI search.
            </p>
          </div>
        </div>
      </div>

      {/* Document list */}
      {loading ? (
        <div className="flex justify-center py-12">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-purple-600 border-t-transparent" />
        </div>
      ) : documents.length === 0 ? (
        <div className="text-center py-12 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800">
          <BookOpen className="h-12 w-12 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-2">No documents yet</h3>
          <p className="text-gray-500 dark:text-gray-400 mb-4 text-sm">
            Upload underwriting guidelines, rate manuals, and policy forms.
            <br />
            AI will use these to assist with rule generation and Q&amp;A.
          </p>
          <button
            onClick={() => fileInputRef.current?.click()}
            className="inline-flex items-center gap-2 px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white text-sm font-medium rounded-lg transition-colors"
          >
            <Upload className="h-4 w-4" />
            <span>Upload First Document</span>
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {documents.map((doc) => {
            const cfg = STATUS_CONFIG[doc.aiStatus] ?? STATUS_CONFIG['pending'];
            return (
              <div
                key={doc.id}
                className="flex items-center gap-4 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-4 hover:shadow-sm transition-shadow"
              >
                <FileIcon type={doc.fileType ?? 'txt'} />

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100 truncate">
                      {doc.filename}
                    </h3>
                    <span
                      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${cfg.color} cursor-help`}
                      title={cfg.hint}
                    >
                      {cfg.icon}
                      <span>{cfg.label}</span>
                    </span>
                  </div>

                  <div className="flex items-center gap-3 text-xs text-gray-500 dark:text-gray-400 mt-1">
                    {doc.fileSizeBytes != null && <span>{formatBytes(doc.fileSizeBytes)}</span>}
                    {doc.fileType && <span className="uppercase font-medium">{doc.fileType}</span>}
                    <span>{new Date(doc.uploadedAt).toLocaleDateString()}</span>
                    {(doc.chunkCount ?? 0) > 0 && (
                      <span className="text-green-600 dark:text-green-400">{doc.chunkCount} chunks</span>
                    )}
                  </div>

                  {doc.aiStatus === 'pending' && (
                    <p className="text-xs text-yellow-700 dark:text-yellow-400 mt-1">
                      Stored in S3. Text extraction runs automatically on AWS deployment (Textract).
                    </p>
                  )}
                  {doc.aiStatus === 'error' && doc.processingError && (
                    <p className="text-xs text-red-600 mt-1">{doc.processingError}</p>
                  )}
                  {doc.description && (
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 truncate">{doc.description}</p>
                  )}
                </div>

                <div className="flex items-center gap-1 flex-shrink-0">
                  {doc.s3Key && (
                    <button
                      onClick={() => handleDownload(doc)}
                      className="p-2 text-gray-500 hover:text-gray-800 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 rounded"
                      title="Download from S3"
                    >
                      <Download className="h-4 w-4" />
                    </button>
                  )}
                  <button
                    onClick={() => handleReprocess(doc)}
                    disabled={reprocessingId === doc.id}
                    className="p-2 text-blue-500 hover:text-blue-700 hover:bg-blue-50 dark:hover:bg-blue-900/30 rounded"
                    title="Request reprocessing"
                  >
                    <RefreshCw className={`h-4 w-4 ${reprocessingId === doc.id ? 'animate-spin' : ''}`} />
                  </button>
                  <button
                    onClick={() => handleDelete(doc)}
                    disabled={deletingId === doc.id}
                    className="p-2 text-red-500 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-900/30 rounded"
                    title="Delete document"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
