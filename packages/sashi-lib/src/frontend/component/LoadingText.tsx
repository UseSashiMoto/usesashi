import React from 'react';

export default function LoadingText() {
  const [data, setData] = React.useState(new Array(7).fill(0));

  React.useEffect(() => {
    let cnt = 0;

    const timer = setInterval(() => {
      setData((n) => {
        let d = n.map((m, i) => {
          return 2 * Math.sin(cnt + 2 * Math.PI * ((i + 1) / 8));
        });

        return d;
      });

      cnt++;
    }, 100);

    return () => {
      clearInterval(timer);
    };
  }, []);

  return (
    <div
      style={{
        position: 'relative',
        height: '24px',
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
      }}
    >
      <div
        style={{
          position: 'relative',
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
        }}
      >
        {data.map((n, index) => {
          return (
            <div
              key={index}
              style={{
                transform: `translateY(${n}px)`,
                backgroundColor: '#999',
                position: 'relative',
                width: '8px',
                height: '8px',
                borderRadius: '50%',
                marginRight: '3px',
              }}
            />
          );
        })}
      </div>
    </div>
  );
}
