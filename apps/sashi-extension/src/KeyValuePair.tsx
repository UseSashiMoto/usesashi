import React, { useState } from 'react';

const KeyValuePair = ({ pair, onUpdate }) => {
  const [value, setValue] = useState(pair.value);

  const handleChange = (e) => {
    setValue(e.target.value);
    onUpdate(pair.key, e.target.value);
  };

  return (
    <div className="flex items-center justify-between p-2 border-b">
      <span className="text-gray-700">{pair.key}</span>
      <input
        type="text"
        value={value}
        onChange={handleChange}
        className="ml-2 border rounded p-1"
      />
    </div>
  );
};

export default KeyValuePair;