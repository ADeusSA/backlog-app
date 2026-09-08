/**
 * Хук electron-builder: отключает опасные предохранители Electron (ТЗ 01 §8).
 * RunAsNode и EnableNodeCliInspectArguments позволяют запустить сборку как обычный Node
 * и получить доступ к файловой системе в обход IPC — выключаем; загрузку кода
 * ограничиваем только asar.
 */
const path = require('node:path')
const { flipFuses, FuseVersion, FuseV1Options } = require('@electron/fuses')

exports.default = async function afterPack(context) {
  const exeName = `${context.packager.appInfo.productFilename}.exe`
  const electronBinary = path.join(context.appOutDir, exeName)

  await flipFuses(electronBinary, {
    version: FuseVersion.V1,
    resetAdHocDarwinSignature: false,
    [FuseV1Options.RunAsNode]: false,
    [FuseV1Options.EnableNodeCliInspectArguments]: false,
    [FuseV1Options.EnableNodeOptionsEnvironmentVariable]: false,
    [FuseV1Options.OnlyLoadAppFromAsar]: true
  })

  console.log(`[after-pack] предохранители применены к ${exeName}`)
}
