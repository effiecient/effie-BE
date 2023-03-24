type UpdatedData = {
  shareConfiguration: {
    isShared: boolean;
    sharedPrivilege: "read" | "write";
  };
};

// type checker
const isUpdatedData = (data: any): data is UpdatedData => {
  console.log(data);
  console.log(data.shareConfiguration.isShared);
  console.log(data.shareConfiguration.sharedPrivilege);

  return (
    data && data.shareConfiguration && (data.shareConfiguration.isShared === false || data.shareConfiguration.isShared === true) && (data.shareConfiguration.sharedPrivilege === "read" || data.shareConfiguration.sharedPrivilege === "write")
  );
};
// export type
export type { UpdatedData };
// export type checker
export { isUpdatedData };
