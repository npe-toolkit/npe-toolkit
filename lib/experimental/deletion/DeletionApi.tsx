import {createApiKey} from '@toolkit/core/api/DataApi';
import {BaseModel} from '@toolkit/data/DataStore';
import type {DeletionGraph} from '@toolkit/experimental/deletion/datastore/deletion.graph';
import type {JobData} from '@toolkit/experimental/deletion/datastore/deletion.workflow';

export const API_DELETION_GET_GRAPH = createApiKey<void, DeletionGraph>(
  'deletion-getGraph',
);

export const API_DELETION_RUN_JOB = createApiKey<JobData, unknown>(
  'deletion-runJob',
);

export const API_DELETION_DRYRUN_DELETION = createApiKey<
  {modelName: string; modelId: string},
  BaseModel[]
>('deletion-dryrunDeletion');

export const API_DELETION_DRYRUN_RESTORATION = createApiKey<
  {modelName: string; modelId: string},
  BaseModel[]
>('deletion-dryrunRestoration');
