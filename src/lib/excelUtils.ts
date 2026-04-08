import * as XLSX from 'xlsx';

export interface ColumnDef {
  key: string;
  header: string;
  width?: number;
  required?: boolean;
  transform?: (value: any) => any; // for export
  parse?: (value: any) => any; // for import
  validate?: (value: any) => string | null; // return error message or null
}

export interface RowValidationError {
  row: number;
  column: string;
  message: string;
}

export interface ParsedImportData {
  rows: Record<string, any>[];
  errors: RowValidationError[];
  newCount: number;
  updateCount: number;
}

export function exportToExcel(
  data: Record<string, any>[],
  columns: ColumnDef[],
  fileName: string,
  sheetName = 'Dados'
) {
  const headers = columns.map(c => c.header);
  const rows = data.map(row =>
    columns.map(col => {
      const val = row[col.key];
      return col.transform ? col.transform(val) : (val ?? '');
    })
  );

  const ws = XLSX.utils.aoa_to_sheet([headers, ...rows]);
  ws['!cols'] = columns.map(c => ({ wch: c.width ?? 18 }));

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, sheetName);
  XLSX.writeFile(wb, `${fileName}.xlsx`);
}

export function downloadTemplate(columns: ColumnDef[], fileName: string, sheetName = 'Modelo') {
  const headers = columns.map(c => c.header);
  const example = columns.map(c => c.key === 'id' ? '(não preencher para novo)' : '');

  const ws = XLSX.utils.aoa_to_sheet([headers, example]);
  ws['!cols'] = columns.map(c => ({ wch: c.width ?? 18 }));

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, sheetName);
  XLSX.writeFile(wb, `${fileName}_modelo.xlsx`);
}

export function parseExcelFile(
  file: File,
  columns: ColumnDef[]
): Promise<ParsedImportData> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target?.result as ArrayBuffer);
        const wb = XLSX.read(data, { type: 'array' });
        const ws = wb.Sheets[wb.SheetNames[0]];
        const jsonData = XLSX.utils.sheet_to_json<Record<string, any>>(ws, { defval: '' });

        const headerToKey: Record<string, ColumnDef> = {};
        columns.forEach(col => {
          headerToKey[col.header.toLowerCase().trim()] = col;
        });

        const errors: RowValidationError[] = [];
        let newCount = 0;
        let updateCount = 0;

        const mapped = jsonData.map((row, idx) => {
          const result: Record<string, any> = {};
          Object.entries(row).forEach(([header, value]) => {
            const col = headerToKey[header.toLowerCase().trim()];
            if (col) {
              result[col.key] = col.parse ? col.parse(value) : value;
            }
          });

          // Determine if new or update
          const hasId = result.id && String(result.id).trim() !== '' && result.id !== '(não preencher para novo)';
          if (hasId) {
            updateCount++;
          } else {
            newCount++;
          }

          // Validate required fields
          columns.forEach(col => {
            if (col.key === 'id') return;
            const val = result[col.key];
            if (col.required && (val === undefined || val === null || String(val).trim() === '')) {
              errors.push({ row: idx + 2, column: col.header, message: 'Campo obrigatório' });
            }
            if (col.validate) {
              const err = col.validate(val);
              if (err) {
                errors.push({ row: idx + 2, column: col.header, message: err });
              }
            }
          });

          return result;
        });

        resolve({ rows: mapped, errors, newCount, updateCount });
      } catch (err) {
        reject(err);
      }
    };
    reader.onerror = () => reject(new Error('Erro ao ler arquivo'));
    reader.readAsArrayBuffer(file);
  });
}
