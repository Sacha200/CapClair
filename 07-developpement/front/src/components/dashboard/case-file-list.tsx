import type { CaseFileListItem } from "@capclair/contract";
import { CaseFileTile } from "./case-file-tile";

/** US-5.4 — liste des dossiers du compte, une `<CaseFileTile>` par dossier. */
export function CaseFileList({ cases }: { cases: CaseFileListItem[] }) {
  return (
    <ul className="mt-4 space-y-2.5">
      {cases.map((caseFile) => (
        <CaseFileTile key={caseFile.id} caseFile={caseFile} />
      ))}
    </ul>
  );
}
