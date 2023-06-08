import {providesValue} from '@toolkit/core/providers/Providers';
import {CodedError} from '@toolkit/core/util/CodedError';
import {BaseModel, ModelClass, ModelUtil} from '@toolkit/data/DataStore';
import {
  FileStore,
  FileStoreOpts,
  FileStoreProviderKey,
  StorageUri,
} from '@toolkit/data/FileStore';
import {useFirebaseStorage} from '@toolkit/experimental/storage/firebase/Storage';

// Default to 10MB max size
const DEFAULT_MAX_BYTES = 10000000;

function useFileStore<T extends BaseModel>(
  dataType: ModelClass<T>,
  field: keyof T,
  opts: FileStoreOpts,
): FileStore {
  const storage = useFirebaseStorage();
  const maxBytes = opts.maxBytes ?? DEFAULT_MAX_BYTES;

  async function upload(toUploadUri: string) {
    const path = `${ModelUtil.getName(dataType)}/${field.toString()}`;

    const fileData = await fetch(toUploadUri);
    const file = await fileData.blob();
    if (file.size > maxBytes) {
      throw new CodedError(
        'npe.storage.toolarge',
        `This file exceeded the maximum upload size of ${maxBytes.toLocaleString()} bytes.`,
      );
    }
    const result = await storage.upload(path, toUploadUri);
    return {httpUrl: result.displayUrl, storageUri: result.uri};
  }

  async function getUrl(storageUri: StorageUri) {
    return storage.download(storageUri);
  }

  return {upload, getUrl};
}

/**
 * Implementation of `FileStore` that uses Firebase Storage.
 *
 * Files are stored at /${instance}/${dataModelName}/${field}/${generatedUUID}.${ext},
 * e.g. "/favezilla/profile/pic/13i4n3a9sf0jq0rjq1.png"
 */
export const FirestoreFilestore = providesValue(
  FileStoreProviderKey,
  useFileStore,
);

type UriResolver = {
  getUrl: (storageUri: StorageUri) => Promise<string>;
  scheme: string;
};

export function useFirebaseStorageResolver(): UriResolver {
  const storage = useFirebaseStorage();
  return {
    getUrl: storage.download,
    scheme: 'firebasestorage',
  };
}
