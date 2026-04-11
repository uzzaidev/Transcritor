import React from 'react';
import { FileAudio, FileVideo, CheckCircle, AlertCircle, Loader2, FileText, Download, Trash2, Users } from 'lucide-react';
import { QueueItem, ProcessStatus } from '../types';

interface FileQueueProps {
    queue: QueueItem[];
    onRemove: (id: string) => void;
    onDownload: (id: string, format: 'txt' | 'md') => void;
    onView: (id: string) => void;
    onClearCompleted: () => void;
}

const FileQueue: React.FC<FileQueueProps> = ({ queue, onRemove, onDownload, onView, onClearCompleted }) => {
    if (queue.length === 0) return null;

    const formatSize = (bytes: number) => {
        if (bytes === 0) return '0 B';
        const k = 1024;
        const sizes = ['B', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
    };

    return (
        <div className="w-full max-w-4xl mx-auto space-y-4">
            <div className="flex justify-between items-center mb-2">
                <h3 className="text-lg font-medium text-slate-300">File Queue ({queue.length})</h3>
                {queue.some(item => item.status === ProcessStatus.COMPLETED || item.status === ProcessStatus.ERROR) && (
                    <button
                        onClick={onClearCompleted}
                        className="text-xs text-slate-500 hover:text-red-400 transition-colors"
                    >
                        Clear Completed
                    </button>
                )}
            </div>

            <div className="grid gap-3">
                {queue.map((item) => (
                    <div
                        key={item.id}
                        className={`
              relative overflow-hidden rounded-lg border p-4 transition-all
              ${item.status === ProcessStatus.PROCESSING
                                ? 'bg-slate-800/80 border-blue-500/50 shadow-lg shadow-blue-900/10'
                                : item.status === ProcessStatus.AWAITING_NAMES
                                    ? 'bg-slate-800/80 border-amber-500/50 shadow-lg shadow-amber-900/10'
                                : 'bg-slate-800/40 border-slate-700/50'}
            `}
                    >
                        {/* Progress Bar Background for Processing */}
                        {item.status === ProcessStatus.PROCESSING && (
                            <div className="absolute top-0 left-0 h-full bg-blue-500/5 transition-all w-full animate-pulse" />
                        )}

                        <div className="relative flex items-center justify-between gap-4">

                            {/* Icon & Info */}
                            <div className="flex items-center gap-4 min-w-0 flex-1">
                                <div className={`
                  p-2 rounded-lg 
                  ${item.status === ProcessStatus.COMPLETED ? 'bg-green-500/20 text-green-400' :
                                        item.status === ProcessStatus.ERROR ? 'bg-red-500/20 text-red-400' :
                                            'bg-slate-700 text-slate-400'}
                `}>
                                    {item.type === 'audio' ? <FileAudio className="w-5 h-5" /> : <FileVideo className="w-5 h-5" />}
                                </div>

                                <div className="min-w-0 flex-1">
                                    <div className="flex items-center gap-2">
                                        <h4 className="text-sm font-medium text-slate-200 truncate" title={item.file.name}>
                                            {item.file.name}
                                        </h4>
                                        <span className="text-xs text-slate-500 whitespace-nowrap">
                                            {formatSize(item.file.size)}
                                        </span>
                                    </div>

                                    <div className="flex items-center gap-2 mt-1">
                                        {item.status === ProcessStatus.PROCESSING && (
                                            <span className="text-xs text-blue-400 flex items-center gap-1">
                                                <Loader2 className="w-3 h-3 animate-spin" />
                                                {item.progressMessage || "Processing..."}
                                            </span>
                                        )}
                                        {item.status === ProcessStatus.PENDING && (
                                            <span className="text-xs text-slate-500">Waiting...</span>
                                        )}
                                        {item.status === ProcessStatus.AWAITING_NAMES && (
                                            <span className="text-xs text-amber-400 flex items-center gap-1.5">
                                                <Users className="w-3 h-3" />
                                                Aguardando identificação dos falantes...
                                            </span>
                                        )}
                                        {item.status === ProcessStatus.COMPLETED && (
                                            <span className="text-xs text-green-400 flex items-center gap-1">
                                                <CheckCircle className="w-3 h-3" />
                                                Completed
                                            </span>
                                        )}
                                        {item.status === ProcessStatus.ERROR && (
                                            <span className="text-xs text-red-400 flex items-center gap-1">
                                                <AlertCircle className="w-3 h-3" />
                                                {item.error || "Failed"}
                                            </span>
                                        )}
                                    </div>
                                </div>
                            </div>

                            {/* Actions */}
                            <div className="flex items-center gap-2">
                                <>
                                    <button
                                        onClick={() => onDownload(item.id, 'txt')}
                                        className="p-2 text-slate-400 hover:text-white hover:bg-slate-700/50 rounded-lg transition-colors"
                                        title="Download Text"
                                    >
                                        <Download className="w-4 h-4" />
                                    </button>

                                    <button
                                        onClick={() => onView(item.id)}
                                        className="p-2 text-slate-400 hover:text-white hover:bg-slate-700/50 rounded-lg transition-colors"
                                        title="View Result"
                                    >
                                        <FileText className="w-4 h-4" />
                                    </button>
                                </>

                                {(item.status === ProcessStatus.PENDING || item.status === ProcessStatus.AWAITING_NAMES || item.status === ProcessStatus.COMPLETED || item.status === ProcessStatus.ERROR) && (
                                    <button
                                        onClick={() => onRemove(item.id)}
                                        className="p-2 text-slate-500 hover:text-red-400 hover:bg-red-900/20 rounded-lg transition-colors"
                                        title="Remove"
                                    >
                                        <Trash2 className="w-4 h-4" />
                                    </button>
                                )}
                            </div>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
};

export default FileQueue;
