// 保存最后一次请求配置
let lastRequest = null;

// 初始化事件监听器
document.addEventListener('DOMContentLoaded', function() {
    // 参数相关事件
    document.getElementById('add-param').addEventListener('click', addParamRow);
    document.getElementById('params-container').addEventListener('click', function(e) {
        if (e.target.classList.contains('remove-btn')) {
            removeRow(e.target, 'param-row');
        }
    });
    
    // 请求头相关事件
    document.getElementById('add-header').addEventListener('click', addHeaderRow);
    document.getElementById('headers-container').addEventListener('click', function(e) {
        if (e.target.classList.contains('remove-btn')) {
            removeRow(e.target, 'header-row');
        }
    });
    
    // 按钮事件
    document.getElementById('send-btn').addEventListener('click', sendRequest);
    document.getElementById('replay-btn').addEventListener('click', replayRequest);
    document.getElementById('clear-btn').addEventListener('click', clearAll);
    document.getElementById('load-current').addEventListener('click', loadCurrentUrl);
    
    // 初始化至少有一行参数和请求头
    if (document.querySelectorAll('.param-row').length === 0) {
        addParamRow();
    }
    if (document.querySelectorAll('.header-row').length === 0) {
        addHeaderRow();
    }
});

// 加载当前页面的URL
function loadCurrentUrl() {
    chrome.tabs.query({ active: true, currentWindow: true }, function(tabs) {
        if (tabs && tabs[0] && tabs[0].url) {
            document.getElementById('url').value = tabs[0].url;
        }
    });
}

// 添加参数行
function addParamRow() {
    const container = document.getElementById('params-container');
    const row = createRow('param');
    container.appendChild(row);
}

// 添加请求头行
function addHeaderRow() {
    const container = document.getElementById('headers-container');
    const row = createRow('header');
    container.appendChild(row);
}

// 创建行元素
function createRow(type) {
    const row = document.createElement('div');
    row.className = `${type}-row`;
    
    row.innerHTML = `
        <input type="text" class="${type}-key" placeholder="Key">
        <input type="text" class="${type}-value" placeholder="Value">
        <button class="remove-btn">Remove</button>
    `;
    
    return row;
}

// 删除行
function removeRow(button, rowClass) {
    const row = button.closest(`.${rowClass}`);
    const container = row.parentElement;
    
    // 确保至少保留一行
    if (container.querySelectorAll(`.${rowClass}`).length > 1) {
        row.remove();
    }
}

// 获取参数
function getParams() {
    const params = {};
    const rows = document.querySelectorAll('.param-row');
    
    rows.forEach(row => {
        const key = row.querySelector('.param-key').value.trim();
        const value = row.querySelector('.param-value').value.trim();
        
        if (key) {
            params[key] = value;
        }
    });
    
    return params;
}

// 获取请求头
function getHeaders() {
    const headers = {};
    const rows = document.querySelectorAll('.header-row');
    
    rows.forEach(row => {
        const key = row.querySelector('.header-key').value.trim();
        const value = row.querySelector('.header-value').value.trim();
        
        if (key) {
            headers[key] = value;
        }
    });
    
    return headers;
}

// 构建完整URL（添加查询参数）
function buildUrl(url, params) {
    if (!url) return '';
    
    const urlObj = new URL(url);
    const searchParams = new URLSearchParams();
    
    // 添加URL中已有的参数
    for (const [key, value] of urlObj.searchParams) {
        searchParams.append(key, value);
    }
    
    // 添加新参数
    for (const [key, value] of Object.entries(params)) {
        searchParams.append(key, value);
    }
    
    urlObj.search = searchParams.toString();
    return urlObj.toString();
}

// 发送请求
async function sendRequest() {
    const method = document.getElementById('method').value;
    let url = document.getElementById('url').value.trim();
    const params = getParams();
    const headers = getHeaders();
    const requestBody = document.getElementById('request-body').value;
    
    if (!url) {
        alert('Please enter a URL');
        return;
    }
    
    // 保存请求配置以便重放
    lastRequest = {
        method,
        url,
        params,
        headers,
        requestBody
    };
    
    // 对于GET请求，将参数添加到URL中
    if (method === 'GET') {
        url = buildUrl(url, params);
    }
    
    // 准备请求配置
    const requestOptions = {
        method: method,
        headers: headers,
        mode: 'cors',
        credentials: 'include'
    };
    
    // 检查是否有Content-Type头
    const hasContentType = Object.keys(headers).some(key => 
        key.toLowerCase() === 'content-type'
    );
    
    // 添加请求体（非GET请求）
    if (method !== 'GET' && requestBody.trim()) {
        requestOptions.body = requestBody;
        
        // 自动检测JSON格式并添加Content-Type头
        if (!hasContentType) {
            try {
                // 尝试解析请求体为JSON
                JSON.parse(requestBody.trim());
                // 如果解析成功，添加JSON Content-Type
                requestOptions.headers['Content-Type'] = 'application/json';
            } catch (e) {
                // 如果不是JSON，不添加Content-Type
            }
        }
    }
    // 对于非GET请求，添加参数到请求体（如果是表单格式）
    else if (method !== 'GET' && Object.keys(params).length > 0) {
        if (!hasContentType) {
            requestOptions.headers['Content-Type'] = 'application/x-www-form-urlencoded';
        }
        
        if (requestOptions.headers['Content-Type'] === 'application/x-www-form-urlencoded') {
            const formData = new URLSearchParams();
            for (const [key, value] of Object.entries(params)) {
                formData.append(key, value);
            }
            requestOptions.body = formData.toString();
        }
    }
    
    try {
        // 显示加载状态
        document.getElementById('send-btn').disabled = true;
        document.getElementById('send-btn').textContent = 'Sending...';
        
        const startTime = performance.now();
        
        // 发送请求
        const response = await fetch(url, requestOptions);
        const endTime = performance.now();
        const responseTime = endTime - startTime;
        
        // 获取响应内容
        let responseText = '';
        try {
            responseText = await response.text();
            // 尝试格式化JSON
            const parsedJson = JSON.parse(responseText);
            responseText = JSON.stringify(parsedJson, null, 2);
        } catch (e) {
            // 如果不是JSON，直接使用文本
        }
        
        // 更新响应显示
        document.getElementById('status-code').textContent = `Status: ${response.status} ${response.statusText}`;
        document.getElementById('response-time').textContent = `Time: ${responseTime.toFixed(2)}ms`;
        document.getElementById('response-body').value = responseText;
        
    } catch (error) {
        document.getElementById('status-code').textContent = 'Error';
        document.getElementById('response-time').textContent = '';
        document.getElementById('response-body').value = `Error: ${error.message}`;
    } finally {
        // 恢复按钮状态
        document.getElementById('send-btn').disabled = false;
        document.getElementById('send-btn').textContent = 'Send Request';
    }
}

// 重放最后一次请求
function replayRequest() {
    if (!lastRequest) {
        alert('No previous request to replay');
        return;
    }
    
    // 恢复最后一次请求的配置
    document.getElementById('method').value = lastRequest.method;
    document.getElementById('url').value = lastRequest.url;
    document.getElementById('request-body').value = lastRequest.requestBody;
    
    // 清除现有参数并添加最后一次的参数
    const paramsContainer = document.getElementById('params-container');
    paramsContainer.innerHTML = '';
    for (const [key, value] of Object.entries(lastRequest.params)) {
        const row = createRow('param');
        row.querySelector('.param-key').value = key;
        row.querySelector('.param-value').value = value;
        paramsContainer.appendChild(row);
    }
    if (paramsContainer.children.length === 0) {
        addParamRow();
    }
    
    // 清除现有请求头并添加最后一次的请求头
    const headersContainer = document.getElementById('headers-container');
    headersContainer.innerHTML = '';
    for (const [key, value] of Object.entries(lastRequest.headers)) {
        const row = createRow('header');
        row.querySelector('.header-key').value = key;
        row.querySelector('.header-value').value = value;
        headersContainer.appendChild(row);
    }
    if (headersContainer.children.length === 0) {
        addHeaderRow();
    }
    
    // 自动发送请求
    sendRequest();
}

// 清除所有内容
function clearAll() {
    document.getElementById('url').value = '';
    document.getElementById('method').value = 'GET';
    document.getElementById('request-body').value = '';
    document.getElementById('status-code').textContent = '';
    document.getElementById('response-time').textContent = '';
    document.getElementById('response-body').value = '';
    
    // 重置参数
    const paramsContainer = document.getElementById('params-container');
    paramsContainer.innerHTML = '';
    addParamRow();
    
    // 重置请求头
    const headersContainer = document.getElementById('headers-container');
    headersContainer.innerHTML = '';
    addHeaderRow();
    
    // 清除最后一次请求记录
    lastRequest = null;
}

// 创建行元素的辅助函数
function createRow(type) {
    const row = document.createElement('div');
    row.className = `${type}-row`;
    
    const keyInput = document.createElement('input');
    keyInput.type = 'text';
    keyInput.className = `${type}-key`;
    keyInput.placeholder = 'Key';
    
    const valueInput = document.createElement('input');
    valueInput.type = 'text';
    valueInput.className = `${type}-value`;
    valueInput.placeholder = 'Value';
    
    const removeBtn = document.createElement('button');
    removeBtn.className = 'remove-btn';
    removeBtn.textContent = 'Remove';
    
    row.appendChild(keyInput);
    row.appendChild(valueInput);
    row.appendChild(removeBtn);
    
    return row;
}

// 删除行的辅助函数
function removeRow(button, rowClass) {
    const row = button.closest(`.${rowClass}`);
    const container = row.parentElement;
    
    // 确保至少保留一行
    if (container.querySelectorAll(`.${rowClass}`).length > 1) {
        row.remove();
    }
}