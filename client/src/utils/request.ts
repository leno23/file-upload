import axios from 'axios'

const request = axios.create({
  baseURL: '/api'
})
request.interceptors.response.use(
  (response: any) => {
    const { data } = response
    return data
  }
)

export default request
