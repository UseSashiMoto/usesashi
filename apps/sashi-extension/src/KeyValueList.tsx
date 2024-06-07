import React from 'react';
import KeyValuePair from './KeyValuePair';

const KeyValueList = ({ pairs, onUpdate }: { pairs: any[]; onUpdate: () => void }) => {
  return (
    <div className="w-full h-full justify-center items-center">
      {pairs.map((pair: { key: React.Key | null | undefined }) => (
        <KeyValuePair key={pair.key} pair={pair} onUpdate={onUpdate} />
      ))}
    </div>
  );
};

export default KeyValueList;
