import { ReactNode } from "react";

export const ResponsiveTable = ({
  columns,
  rows,
  footer
}: {
  columns: string[];
  rows: ReactNode[][];
  footer?: ReactNode[];
}) => (
  <div className="table-wrap">
    <table>
      <thead>
        <tr>{columns.map((column) => <th key={column}>{column}</th>)}</tr>
      </thead>
      <tbody>
        {rows.length ? (
          rows.map((row, rowIndex) => (
            <tr key={rowIndex}>
              {row.map((cell, cellIndex) => (
                <td key={cellIndex} data-label={columns[cellIndex]}>
                  {cell}
                </td>
              ))}
            </tr>
          ))
        ) : (
          <tr>
            <td colSpan={columns.length} className="empty-cell">
              Nenhum dado encontrado.
            </td>
          </tr>
        )}
      </tbody>
      {footer && (
        <tfoot>
          <tr>
            {footer.map((cell, index) => (
              <td key={index} data-label={columns[index]}>
                {cell}
              </td>
            ))}
          </tr>
        </tfoot>
      )}
    </table>
  </div>
);
