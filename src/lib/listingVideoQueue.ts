const DB_NAME = 'carbuy-listing-videos'
const DB_VERSION = 1
const STORE = 'pending'

export type PendingListingVideosRecord = {
  listingId: string
  ownerId: string
  videoBlob: Blob
  videoName: string
  videoType: string
  flawsVideoBlob: Blob | null
  flawsVideoName: string | null
  flawsVideoType: string | null
  createdAt: number
}

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION)
    request.onerror = () => reject(request.error ?? new Error('IndexedDB open failed'))
    request.onupgradeneeded = () => {
      const db = request.result
      if (!db.objectStoreNames.contains(STORE)) {
        db.createObjectStore(STORE, { keyPath: 'listingId' })
      }
    }
    request.onsuccess = () => resolve(request.result)
  })
}

function runTransaction<T>(
  mode: IDBTransactionMode,
  fn: (store: IDBObjectStore) => IDBRequest<T>,
): Promise<T> {
  return openDb().then(
    (db) =>
      new Promise<T>((resolve, reject) => {
        const tx = db.transaction(STORE, mode)
        const store = tx.objectStore(STORE)
        const request = fn(store)
        request.onerror = () => reject(request.error ?? new Error('IndexedDB request failed'))
        request.onsuccess = () => resolve(request.result as T)
        tx.oncomplete = () => db.close()
        tx.onerror = () => reject(tx.error ?? new Error('IndexedDB transaction failed'))
      }),
  )
}

export async function savePendingListingVideos(input: {
  listingId: string
  ownerId: string
  videoFile: File
  flawsVideoFile?: File | null
}): Promise<void> {
  const record: PendingListingVideosRecord = {
    listingId: input.listingId,
    ownerId: input.ownerId,
    videoBlob: input.videoFile,
    videoName: input.videoFile.name,
    videoType: input.videoFile.type || 'video/mp4',
    flawsVideoBlob: input.flawsVideoFile ?? null,
    flawsVideoName: input.flawsVideoFile?.name ?? null,
    flawsVideoType: input.flawsVideoFile?.type ?? null,
    createdAt: Date.now(),
  }
  await runTransaction('readwrite', (store) => store.put(record))
}

export async function loadPendingListingVideos(
  listingId: string,
): Promise<PendingListingVideosRecord | null> {
  try {
    const record = await runTransaction<PendingListingVideosRecord | undefined>('readonly', (store) =>
      store.get(listingId),
    )
    return record ?? null
  } catch {
    return null
  }
}

export async function listPendingListingVideosForOwner(
  ownerId: string,
): Promise<PendingListingVideosRecord[]> {
  try {
    const all = await runTransaction<PendingListingVideosRecord[]>('readonly', (store) => store.getAll())
    return all.filter((record) => record.ownerId === ownerId)
  } catch {
    return []
  }
}

export async function removePendingListingVideos(listingId: string): Promise<void> {
  try {
    await runTransaction('readwrite', (store) => store.delete(listingId))
  } catch {
    // ignore cleanup errors
  }
}

export function pendingRecordToFiles(record: PendingListingVideosRecord): {
  videoFile: File
  flawsVideoFile: File | null
} {
  const videoFile = new File([record.videoBlob], record.videoName, {
    type: record.videoType || 'video/mp4',
    lastModified: record.createdAt,
  })
  const flawsVideoFile =
    record.flawsVideoBlob && record.flawsVideoName
      ? new File([record.flawsVideoBlob], record.flawsVideoName, {
          type: record.flawsVideoType || 'video/mp4',
          lastModified: record.createdAt,
        })
      : null
  return { videoFile, flawsVideoFile }
}
