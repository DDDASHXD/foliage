export const OPENMD_PATH_MIME = 'text/openmd-path'
export const OPENMD_SOURCE_GROUP_MIME = 'text/openmd-source-group'
/** Set to "1" for workspace tree directories, "0" for files; omitted for tab drags. */
export const OPENMD_IS_DIR_MIME = 'text/openmd-is-dir'

export const isTreeDirectoryDrag = (dataTransfer: DataTransfer) =>
  dataTransfer.getData(OPENMD_IS_DIR_MIME) === '1'
