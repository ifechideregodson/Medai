export type DicomMetadata = {
  studyInstanceUid?: string;
  seriesInstanceUid?: string;
  modality?: string;
  studyDate?: string;
  accessionNumber?: string;
  studyDescription?: string;
  seriesDescription?: string;
  seriesNumber?: number;
  bodyPart?: string;
};

export async function extractDicomMetadata(bytes: Uint8Array): Promise<DicomMetadata> {
  const mod = await import("dcmjs");
  const dcmBuffer = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
  const dataSet = mod.data.DicomMessage.readFile(dcmBuffer);
  const natural = mod.data.DicomMetaDictionary.namifyDataset(dataSet.dict);
  const number = (v: unknown) => v == null ? undefined : Number(Array.isArray(v) ? v[0] : v);
  const first = (v: unknown) => Array.isArray(v) ? v[0] : v;
  return {
    studyInstanceUid: first(natural.StudyInstanceUID as unknown) as string | undefined,
    seriesInstanceUid: first(natural.SeriesInstanceUID as unknown) as string | undefined,
    modality: first(natural.Modality as unknown) as string | undefined,
    studyDate: first(natural.StudyDate as unknown) as string | undefined,
    accessionNumber: first(natural.AccessionNumber as unknown) as string | undefined,
    studyDescription: first(natural.StudyDescription as unknown) as string | undefined,
    seriesDescription: first(natural.SeriesDescription as unknown) as string | undefined,
    seriesNumber: number(natural.SeriesNumber),
    bodyPart: first(natural.BodyPartExamined as unknown) as string | undefined
  };
}