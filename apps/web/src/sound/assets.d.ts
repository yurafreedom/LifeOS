/* Vite resolves an imported audio file to its served URL. */
declare module '*.mp3' {
  const url: string;
  export default url;
}
