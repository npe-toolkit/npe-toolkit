import {Role, User} from '@toolkit/core/api/User';
import {
  BaseModel,
  Field,
  Model,
  TArray,
  TString,
} from '@toolkit/data/DataStore';

/**
 * Allowlist is a data stucture to give permissions and access to the app.
 *
 * It supports assigning roles to users by email, phone, or 3P account ID
 * before they have signed up, or by user ID after they have signed up.
 *
 * TODO: Rename this to a more generic term.
 */
@Model({name: 'allowlist'})
export class AllowlistEntry extends BaseModel {
  /** User Key can be email, phone, or user ID depending on login type */
  @Field() userKey: string;

  /** Roles is array of roles for that user */
  @Field(TArray(TString)) roles: Role[];

  /** Signed in user ths entry applies to. */
  @Field() user?: User;
}
