export const handleApiError = (error: any): string => {
  let err = "";
  if (error?.response?.data?.message) {
    err = error?.response?.data?.message;
  } else {
    err = error.message;
  }
  return err;
};
