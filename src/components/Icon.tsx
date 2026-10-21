const paths = {
  plus: 'M12 5v14M5 12h14',
  close: 'm6 6 12 12M18 6 6 18',
  trash: 'M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13M10 11v5M14 11v5',
  list: 'M8 6h12M8 12h12M8 18h12M4 6h.01M4 12h.01M4 18h.01',
  chevron: 'm9 5 7 7-7 7',
  search: 'M10.5 18a7.5 7.5 0 1 0 0-15 7.5 7.5 0 0 0 0 15m5.5-2 5 5',
  clock: 'M12 8v4l3 2M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0',
  menu: 'M4 6h16M4 12h16M4 18h16',
  logout: 'M10 4H4v16h6M9 12h12m-4-4 4 4-4 4',
  chart: 'M4 20V4M4 20h17M8 16v-4M13 16V6M18 16v-7',
  box: 'm3 7 9-4 9 4-9 4-9-4m0 0v10l9 4 9-4V7M12 11v10',
  refresh: 'M20 7v5h-5M4 17v-5h5M5.5 8a7 7 0 0 1 11-3L20 8M4 16l3.5 3a7 7 0 0 0 11-3',
};

export type IconName = keyof typeof paths;

export function Icon({ name, size = 20 }: { name: IconName; size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d={paths[name]} />
    </svg>
  );
}
