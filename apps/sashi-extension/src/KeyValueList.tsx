import React from 'react';
import KeyValuePair from './KeyValuePair';

const KeyValueList = ({ pairs, onUpdate }) => {
  return (
    <div>
      {pairs.map((pair) => (
        <KeyValuePair key={pair.key} pair={pair} onUpdate={onUpdate} />
      ))}
    </div>
  );
};

export default KeyValueList;