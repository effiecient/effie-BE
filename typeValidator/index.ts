import { ShareConfiguration } from "../type/shareConfiguration";

// type Validator
export const isShareConfiguration = (shareConfiguration: ShareConfiguration): boolean => {
  if (typeof shareConfiguration?.isShared !== "boolean") {
    return false;
  }
  if (shareConfiguration.sharedPrivilege) {
    if (shareConfiguration.sharedPrivilege !== "viewer" && shareConfiguration.sharedPrivilege !== "editor") {
      return false;
    }
  }
  return true;
};
