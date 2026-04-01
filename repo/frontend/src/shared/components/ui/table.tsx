import type { PropsWithChildren } from 'react';

export function Table({ children }: PropsWithChildren) { return <table className="w-full caption-bottom text-sm">{children}</table>; }
export function TableRow({ children }: PropsWithChildren) { return <tr className="border-b">{children}</tr>; }
export function TableHead({ children }: PropsWithChildren) { return <th className="h-12 px-4 text-left align-middle font-medium">{children}</th>; }
export function TableCell({ children }: PropsWithChildren) { return <td className="p-4 align-middle">{children}</td>; }
