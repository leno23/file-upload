<template>
  <!-- <img alt="Vue logo" src="./assets/logo.png" />
  <HelloWorld msg="Hello Vue 3 + TypeScript + Vite" /> -->
  <el-card class="box-card" header='文件列表'>
    <div
      v-for="item of state.fileList"
      :key="item"
    >
      {{ item }}
    </div></el-card
  >
  <el-progress
   :text-inside="true" :stroke-width="26"
    :percentage="uploadProgress"
  ></el-progress>
  <input
    type="file"
    name="file"
    @change="handleFileChange"
  />
  <el-button type="primary" @click="handleUpload"
    >上传</el-button
  >
</template>

<script setup lang="ts">
import { ext, createFileChunk } from '@/utils'
import {
  calculateHash,
  calculateHashIdle,
  calculateHashSample
} from '@/utils/hash'
import { file, check, upload, merge } from '@/api'
import { ElMessage } from 'element-plus'

const CHUNK_SIZE = 1 * 1024 * 1024 // 1M
const state: any = reactive({
  file: null,
  hash: null,
  chunks: [],
  fileList: []
})
// 获取文件列表
const fetchFileList = async () => {
  const { data } = await file()
  state.fileList = data
}

onMounted(() => {
  fetchFileList()
})

const handleFileChange = (e) => {
  const [file] = e.target.files
  if (!file) return
  state.file = file
}

const uploadProgress = computed(() => {
  const { file, chunks } = state
  if (!file || !chunks.length) return 0
  const loaded = chunks
    .map(
      (item) => item.chunk.size * item.progress
    )
    .reduce((acc, cur) => acc + cur)
  return parseInt((loaded / file.size).toFixed(2))
})
// 上传
const handleUpload = async () => {
  const { file } = state
  if (!file) {
    ElMessage.info('请选择文件')
    return
  }

  const chunks = createFileChunk(file)

  // 计算 hash 文件指纹标识
  // state.hash = await calculateHash(file);
  // web-worker 防止卡顿主线程（略）
  // requestIdleCallback
  // state.hash = await calculateHashIdle(chunks);

  // 抽样哈希，牺牲一定的准确率换来效率，hash 一样的不一定是同一个文件，但是不一样的一定不是
  state.hash = await calculateHashSample(file)

  const { hash } = state

  const { uploaded, uploadedList }: any =
    await check({
      ext: ext(file.name),
      hash
    })

  if (uploaded) {
    return ElMessage.info(
      '已存在，无需再次上传！'
    )
  }

  state.chunks = chunks.map((chunk, index) => {
    // 每一个切片的名字
    const chunkName = `${hash}-${index}`
    return {
      hash,
      chunk: chunk.file,
      name: chunkName,
      index,
      // 设置进度条
      progress:
        uploadedList.indexOf(chunkName) > -1
          ? 100
          : 0
    }
  })

  await uploadChunks(uploadedList)
}

const uploadChunks = async (
  uploadedList = []
) => {
  const { chunks, file } = state
  const list = chunks
    .filter(
      (chunks) =>
        uploadedList.indexOf(chunks.name) == -1
    )
    .map(({ chunk, name, hash, index }) => {
      const form = new FormData()
      form.append('chunkname', name)
      form.append('ext', ext(file.name))
      form.append('hash', hash)
      form.append('file', chunk)
      return { form, index, error: 0 }
    })

  try {
    await sendRequest([...list], 4)
    if (
      uploadedList.length + list.length ===
      chunks.length
    ) {
      await mergeRequest()
      ElMessage.success('上传成功！')
      fetchFileList()
    }
  } catch (error) {
    ElMessage.error('上传似乎出了点问题～')
  }
}

const sendRequest = (chunks, limit = 4) => {
  return new Promise((resolve, reject) => {
    const len = chunks.length
    let counter = 0
    let isStop = false

    const start = async () => {
      if (isStop) {
        return
      }

      const task = chunks.shift()

      if (task) {
        const { form, index } = task

        try {
          await upload(form, {
            onUploadProgress: (progress) => {
              const { loaded, total } = progress
              state.chunks[index].progress =
                Number(
                  (
                    (loaded / total) *
                    100
                  ).toFixed(2)
                )
            }
          })

          if (counter === len - 1) {
            resolve()
          } else {
            counter++
            start()
          }
        } catch (error) {
          // 当前切片报错了
          // 尝试 3 次重试机制，重新 push 到数组中
          console.log('出错了')
          if (task.error < 3) {
            task.error++
            // 队首进去，准备重试
            chunks.unshift(task)
            start()
          } else {
            // 错误 3 次了，直接结束
            isStop = true
            reject()
          }
        }
      }
    }

    while (limit > 0) {
      setTimeout(() => {
        // 模拟延迟
        start()
      }, Math.random() * 2000)

      limit -= 1
    }
  })
}

const mergeRequest = async () => {
  const { file, hash } = state
  await merge({
    ext: ext(file.name),
    size: CHUNK_SIZE,
    hash
  })
}
</script>

<style lang='stylus'>
#app 
  color #2c3e50
  width 500px
  margin 0 auto
.el-progress
  margin 10px 0
</style>
