export interface KunUploadInitResponse {
  uploadUrl: string
  token: string
  expiresIn: number
}

export interface KunUploadCompleteResponse {
  filetype: 's3'
  fileToken: string
  fileSize: string
}

export interface KunVideoChunkMetadata {
  chunkIndex: number
  totalChunks: number
  fileId: string
  fileName: string
  fileSize: number
  mimeType: string
  filepath: string
}
