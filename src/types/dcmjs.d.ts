declare module "dcmjs" {
  const dcmjs: {
    data: {
      DicomMessage: {
        readFile(input: ArrayBuffer): {
          dict: Record<string, unknown>;
        };
      };
      DicomMetaDictionary: {
        namifyDataset(dict: Record<string, unknown>): Record<string, unknown>;
      };
    };
  };

  export = dcmjs;
}
