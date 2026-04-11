
export interface FileChunk {
    blob: Blob;
    index: number;
    total: number;
    start: number;
    end: number;
}

export const CHUNK_SIZE = 24 * 1024 * 1024; // 24MB (Safe for OpenAI 25MB limit)

export const getFileChunks = (file: File): FileChunk[] => {
    const chunks: FileChunk[] = [];
    let start = 0;
    const total = Math.ceil(file.size / CHUNK_SIZE);

    while (start < file.size) {
        const end = Math.min(start + CHUNK_SIZE, file.size);
        const blob = file.slice(start, end);
        chunks.push({
            blob,
            index: chunks.length,
            total,
            start,
            end
        });
        start = end;
    }

    return chunks;
};

export const formatBytes = (bytes: number, decimals = 2) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const dm = decimals < 0 ? 0 : decimals;
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB', 'PB', 'EB', 'ZB', 'YB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
};
