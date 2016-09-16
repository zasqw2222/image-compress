;(function () {
  var file
  var fileType
  var url
  var compressedImageDataURL
  var compressSuccess = false
  var contentType // 从 canvas.toDataURL 的结果中获取的 contentType
  var pureBase64ImageData // 不包含 /^data:image\/(.+);base64,/ 的 base64 字符串
  var binaryString // atob 转码后的 二进制文本 
  var boundary = 'customFileboundary'
  var boundaryString // 构造为 multipart 的文本
  var arrayBuffer // 需要用 ajax 发送的 ArrayBuffer

  function asyncClick (doms, i) {
    setTimeout(function () {
      if (i < doms.length) {
        doms[i++].click()
        asyncClick(doms, i)
      }
    }, 50)
  }

  function autoClick () {
    asyncClick([
      J_GetImageFile,
      J_LoadImageByURL,
      J_DrawImage,
      J_CompressImage,
      J_Atob,
      J_ConcatBinaryStirng,
      J_String2ArrayBuffer
    ], 0)
  }

  // file on change
  J_File.addEventListener('change', function (e) {
    if (e.target.value) {
      J_GetImageFile.removeAttribute('disabled')
    } else {
      J_GetImageFile.setAttribute('disabled', true)
    }
    autoClick()
  })

  // get file
  J_GetImageFile.addEventListener('click', function () {
    var fileName
    file = J_File.files[0]
    fileName = file.name
    fileType = file.type || 'image/' + fileName.substr(fileName.lastIndexOf('.') + 1)
    J_ImageObject.innerText = [
      'file.name: ' + fileName,
      'file.type: ' + fileType,
      'file.size: ' + file.size
    ].join('\r\n')
    J_LoadImageByURL.removeAttribute('disabled')
    J_LoadImageByFileReader.removeAttribute('disabled')
  })

  // image load
  J_Image.addEventListener('load', function () {
    J_DrawImage.removeAttribute('disabled')
  })

  J_Image.addEventListener('error', function () {
    alert('image load error')
  })

  // get dataURL/BlobURL
  // URL
  J_LoadImageByURL.addEventListener('click', function () {
    if (url) {
      window.URL.revokeObjectURL(url)
    }
    url = window.URL.createObjectURL(file)

    J_Image.removeAttribute('src')
    J_Image.src = url
    J_ImageURL.innerText = url
  })
  // FileReader
  J_LoadImageByFileReader.addEventListener('click', function () {
    var fileReader = new FileReader()

    J_Image.removeAttribute('src')
    fileReader.onload = function (e) {
      var dataURL = e.target.result
      J_Image.src = dataURL
      J_ImageURL.innerText = dataURL
    }
    fileReader.readAsDataURL(file)
  })

  // drawImage to canvas
  J_DrawImage.addEventListener('click', function () {
    var sourceImage = J_Image
    var canvas = J_ImageCanvas
    var context = canvas.getContext('2d')

    if (!isCanvasBlank(canvas)) {
      context.clearRect(0, 0, canvas.width, canvas.height)
    }
    canvas.width = sourceImage.naturalWidth
    canvas.height = sourceImage.naturalHeight
    context.drawImage(sourceImage, 0, 0)

    J_CompressImage.removeAttribute('disabled')
  })

  J_CompressImage.addEventListener('click', function () {
    /*
    * HTMLCanvasElement.toDataURL() 不支持传入的类型非“image/png”，
    * 但是值以“data:image/png”开头的类型。
    */
    var canvas = J_ImageCanvas
    var mimeType = fileType || 'image/png'
    var quality = 30
    var compressedBlob

    compressedImageDataURL = canvas.toDataURL(mimeType, quality / 100)
    compressedBlob = dataURL2Blob(compressedImageDataURL)

    J_MimeType.innerText = mimeType
    J_CompressedImageDataURL.innerText = compressedImageDataURL
    J_SourceFileSize.innerText = file.size
    J_CompressedFileSize.innerText = compressedBlob.size
    J_Atob.removeAttribute('disabled')
    J_XHRBlobMultiparty.removeAttribute('disabled')
    J_XHRBlobMulter.removeAttribute('disabled')

    if (compressedBlob.size > file.size) {
      // 文件压缩后，比原文件大
      console.log(compressedBlob.size + ' > ' + file.size)
      return
    }
    compressSuccess = true
  })
  
  // atob
  J_Atob.addEventListener('click', function () {
    pureBase64ImageData = compressedImageDataURL.replace(/^data:(image\/.+);base64,/, function ($0, $1) {
      contentType = $1
      return ''
    })

    // atob
    binaryString = atob(pureBase64ImageData)

    J_PureBase64Data.innerText = pureBase64ImageData
    J_ContentType.innerText = contentType
    J_BinaryString.innerText = binaryString
    J_ConcatBinaryStirng.removeAttribute('disabled')
  })

  J_ConcatBinaryStirng.addEventListener('click', function () {
    boundaryString = [
      '--' + boundary,
      'Content-Disposition: form-data; name="file"; filename="' + (file.name || 'blob') + '"',
      'Content-Type: ' + contentType,
      '', binaryString,
      '--' + boundary + '--', ''
    ].join('\r\n')

    J_MultipartBinaryString.innerText = boundaryString
    J_String2ArrayBuffer.removeAttribute('disabled')
  })

  J_String2ArrayBuffer.addEventListener('click', function () {
    arrayBuffer = string2ArrayBuffer(boundaryString)

    J_ArrayBuffer.innerText = arrayBuffer
    J_XHRMultiparty.removeAttribute('disabled')
    J_XHRMulter.removeAttribute('disabled')
  })
  
  function sendArrayBuffer (url) {
    return function () {
      var xhr = new XMLHttpRequest()
      xhr.withCredentials = true
      xhr.open('POST', url, true)
      xhr.setRequestHeader('Content-Type', 'multipart/form-data; boundary=' + boundary)

      xhr.addEventListener('load', function () {
        if (
          xhr.status >= 200 && xhr.status < 300 ||
          xhr.status == 304
        ) {
          J_UploadResult_XHR.innerText = '--- SUCCESS ---\n' + JSON.stringify(JSON.parse(xhr.responseText), null, 2)
        } else {
          J_UploadResult_XHR.innerText =
            '--- ERROR: ' + xhr.status + ' ---\n' + JSON.stringify(JSON.parse(xhr.responseText), null, 2)
        }
      })

      xhr.send(arrayBuffer)
    }
  }

  // use XMLHttpRequest send Array Buffer
  J_XHRMultiparty.addEventListener('click', sendArrayBuffer('http://localhost:8080/api/upload/multiparty'))
  J_XHRMulter.addEventListener('click', sendArrayBuffer('http://localhost:8080/api/upload/multer'))

  function sendBlob (url) {
    return function () {
      var fd = new FormData()
      var xhr = new XMLHttpRequest()
      var blobFile = dataURL2Blob(compressedImageDataURL)

      fd.append('file', blobFile, file.name)

      xhr.open('POST', url, true)
      xhr.withCredentials = true
      xhr.addEventListener('load', function () {
        if (
          xhr.status >= 200 && xhr.status < 300 ||
          xhr.status == 304
        ) {
          J_UploadResult_XHRBlob.innerText = '--- SUCCESS ---\n' + JSON.stringify(JSON.parse(xhr.responseText), null, 2)
        } else {
          J_UploadResult_XHRBlob.innerText =
            '--- ERROR: ' + xhr.status + ' ---\n' + JSON.stringify(JSON.parse(xhr.responseText), null, 2)
        }
      })
      xhr.send(fd)
    }
  }

  // use XMLHttpRequest & FormData send blob
  J_XHRBlobMultiparty.addEventListener('click', sendBlob('http://localhost:8080/api/upload/multiparty'))
  J_XHRBlobMulter.addEventListener('click', sendBlob('http://localhost:8080/api/upload/multer'))
}())
