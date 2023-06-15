import {AuthData} from 'firebase-functions/lib/common/providers/https';
import {Role} from '@toolkit/core/api/User';
import {Opt} from '@toolkit/core/util/Types';
import {useDataStore} from '@toolkit/data/DataStore';
import {AllowlistEntry} from '@toolkit/tbd/Allowlist';

function hasValue(value: Opt<string>) {
  return value != null && value !== '';
}

export async function getAllowlistMatchedRoles(
  auth: AuthData,
): Promise<Role[]> {
  const allowlistStore = useDataStore(AllowlistEntry);
  const {phone, email} = auth.token;

  let [phoneEntry, emailEntry] = await Promise.all([
    hasValue(phone) ? allowlistStore.get('allowlist:' + phone) : {roles: []},
    hasValue(email)
      ? allowlistStore.get('allowlist:' + email ?? '')
      : {roles: []},
  ]);

  const phoneRoles = phoneEntry ? phoneEntry.roles : [];
  const emailRoles = emailEntry ? emailEntry.roles : [];

  return [...phoneRoles, ...emailRoles];
}
