
import { Table, TableBody, TableCaption, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { motion } from 'framer-motion';
import * as React from 'react';

interface TableProps {
  data: {
    data: Array<{ [key: string]: any }>;
  };
  caption?: string;
}

export const TableComponent: React.FC<TableProps> = ({ data, caption }) => {
  if (!data || !data.data || data.data.length === 0) return <p>No data available.</p>;

  const tableData = data.data;
  const headers = Object.keys(tableData[0]);

  // Animation variants
  const tableVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        when: 'beforeChildren',
        staggerChildren: 0.1,
      },
    },
  };

  const rowVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: {
      opacity: 1,
      y: 0,
      transition: {
        type: 'spring',
        stiffness: 100,
        damping: 12,
      },
    },
  };

  return (
    <motion.div initial="hidden" animate="visible" variants={tableVariants}>
      <Table>
        {caption && <TableCaption>{caption}</TableCaption>}
        <TableHeader>
          <TableRow>
            {headers.map((header) => (
              <TableHead key={header}>{header}</TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {tableData.map((row, rowIndex) => (
            <motion.tr key={rowIndex} variants={rowVariants}>
              {headers.map((header) => (
                <TableCell key={header}>{row[header]}</TableCell>
              ))}
            </motion.tr>
          ))}
        </TableBody>
      </Table>
    </motion.div>
  );
};
