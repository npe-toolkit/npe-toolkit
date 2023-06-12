import {use} from '@toolkit/core/providers/Providers';
import {type Opt} from '@toolkit/core/util/Types';
import {
  BaseModel,
  Field,
  Model,
  TArray,
  TModel,
  TString,
} from '@toolkit/data/DataStore';
import {NotLoggedInError} from '@toolkit/tbd/CommonErrors';
import {providerKeyFor} from '../providers/Providers';

/**
 * Role for users in an app.
 * Strings below are well-known roles, and apps can define custom roles
 * using `app.ROLE`
 */
export type Role = 'admin' | 'dev' | 'allowlist' | `app.${string}`;
export const SYSTEM_ROLES: Role[] = ['admin', 'dev', 'allowlist'];

@Model({name: 'user_roles'})
export class UserRoles extends BaseModel {
  @Field(TArray(TString)) roles: Role[];
}

/**
 * Base type for users.
 *
 * Only id, name, and canLogin are required fields to set.
 *
 * All other fields are optional, and if set they will be used in a "standard" way for that type of field.
 */
@Model({name: 'user'})
export class User extends BaseModel {
  /**
   * A name that can be used in the UI to show to the user to identity which account
   * is logged in with. Generally this is full name, username, or the user's email
   */
  @Field(TString) name: string;
  /**
   * URL of the user's profile picture
   */
  @Field(TString) pic?: Opt<string>;
  /**
   * The user's primary email
   */
  @Field(TString) email?: Opt<string>;
  /**
   * The user's primary phone number,
   * formatted for the country of the current request.
   */
  @Field(TString) phone?: Opt<string>;

  // *** Fields below are added to the user object and not part of the User Model ***

  /**
   * Whether the user is allowed to view content and take operations asa a fully
   * logged-in user
   */
  canLogin?: Opt<boolean>;
  /**
   * 
  /**
   * Set of roles associated with the user (e.g. "admin", "dev")
   *
   * All enforcement of role-based access is handled on the server, and on the server,
   * this field is authoritative. On the client, these values are provided to determine
   * what UI and actions to make available to the user
   */
  roles?: UserRoles;

  /**
   * Whether the phone # has been verified
   */
  phoneVerified?: Opt<boolean>;

  /**
   * Whether the email has been verified
   */
  emailVerified?: Opt<boolean>;

  /**
   * Reason user can't log in
   */
  cantLoginReason?: 'onboarding' | 'suspended' | 'unknown';
}

/**
 * @deprecated
 * Old type for profiles. We are moving to definitions for Profile defined
 * on a per-app basis.
 */
@Model({name: 'profile'})
export class Profile extends BaseModel {
  @Field(TString) pic?: string | null | undefined;
  @Field(TString) name: string;
  @Field(TModel(User)) user?: User;
}

export const LoggedInUserKey = providerKeyFor<Opt<User>>({name: 'user'});

/**
 * Special key to look up user without throwing.
 *
 * Standard practice on client is for the user key lookup to
 * throw React Suspense promise if auth system hasn't initailized.
 *
 * However some code paths need to be able to recover, and you can't just
 * catch the thrown promise as it can break hooks ordering rules.
 */
export const LoggedInUserKeyNoThrow = providerKeyFor<Opt<User>>({
  name: 'usernothrow',
  defaultValue: null,
});

/**
 * Hook to get the current user.
 *
 * Throws a promise if initial user hasn't been set as part of app startup.
 */
export function useLoggedInUser<UserType extends User>(): Opt<UserType> {
  return use(LoggedInUserKey) as Opt<UserType>;
}

/**
 * Hook to get the current user.
 *
 * Throws an error that should be caught and redirected to a login page if there
 * the user is not logged in.
 *
 * Throws a promise if initial user hasn't been set as part of app startup.
 */
export function requireLoggedInUser<UserType extends User>(): UserType {
  const user = useLoggedInUser<UserType>();
  if (user == null) {
    throw NotLoggedInError();
  }
  return user;
}
