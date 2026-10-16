<template>
  <div class="system-settings">
    <!-- AI 配置概览卡片 -->
    <el-card class="overview-card">
      <template #header>
        <div class="card-header">
          <span><el-icon><Setting /></el-icon> 系统配置概览</span>
          <el-button type="primary" plain size="small" @click="handleRefresh">
            <el-icon><Refresh /></el-icon> 刷新配置
          </el-button>
        </div>
      </template>

      <el-descriptions :column="6" border size="default">
        <el-descriptions-item label="AI 智能体">
          <el-tag :type="providerTagType" size="default">{{ providerLabel }}</el-tag>
        </el-descriptions-item>
        <el-descriptions-item label="默认模型">
          <span class="overview-model">{{ savedModelLabel }}</span>
        </el-descriptions-item>
        <el-descriptions-item label="DeepSeek">
          <el-tag :type="aiOverview.deepseekConfigured ? 'success' : 'info'" size="small">
            {{ aiOverview.deepseekConfigured ? '已配置' : '未配置' }}
          </el-tag>
        </el-descriptions-item>
        <el-descriptions-item label="通义千问">
          <el-tag :type="aiOverview.qianwenConfigured ? 'success' : 'info'" size="small">
            {{ aiOverview.qianwenConfigured ? '已配置' : '未配置' }}
          </el-tag>
        </el-descriptions-item>
        <el-descriptions-item label="Dify 工作流">
          <el-tag :type="aiOverview.difyAnalyzeConfigured && aiOverview.difyGenerateConfigured ? 'success' : 'info'" size="small">
            {{ aiOverview.difyAnalyzeConfigured && aiOverview.difyGenerateConfigured ? '已配置' : '未配置' }}
          </el-tag>
        </el-descriptions-item>
        <el-descriptions-item label="Mock 模式">
          <el-tag :type="aiOverview.mockEnabled ? 'warning' : 'success'" size="small">
            {{ aiOverview.mockEnabled ? '已启用' : '已关闭' }}
          </el-tag>
        </el-descriptions-item>
      </el-descriptions>
    </el-card>

    <!-- 配置Tab页 -->
    <el-card>
      <template #header>
        <div class="card-header">
          <span><el-icon><Tools /></el-icon> 系统配置管理</span>
        </div>
      </template>

      <el-tabs v-model="activeTab" type="border-card">
        <!-- AI 智能体配置 -->
        <el-tab-pane label="AI 配置" name="ai">
          <div class="ai-config-intro">
            <div>
              <div class="section-kicker">模型通路</div>
              <h3>选择系统默认 AI 服务</h3>
              <p>模型选择会同时影响学情分析、错题解析和智能出题。</p>
            </div>
            <div class="active-model-summary">
              <span class="summary-label">当前默认</span>
              <strong>{{ currentVendorLabel }}</strong>
              <span class="summary-model">{{ currentVendorModelLabel }}</span>
            </div>
          </div>

          <!-- ============ [2026-10-16 新增] 多厂商模型档案管理 ============ -->
          <div class="vendor-manager">
            <div class="vendor-manager-head">
              <div>
                <div class="section-kicker">厂商档案</div>
                <h3>多厂商模型管理</h3>
                <p>
                  一条档案 = 一个网关地址 + 一把 Key + 一个默认模型。选为「当前」后，
                  学情分析 / 错题解析 / 智能出题全部走它；未启用档案时回落到下面的内置直连通路。
                </p>
              </div>
              <div class="vendor-manager-actions">
                <el-button type="primary" :icon="Plus" @click="openVendorDialog()">新增厂商</el-button>
                <el-button :icon="Refresh" :loading="vendorLoading" @click="loadVendorProfiles">刷新</el-button>
              </div>
            </div>

            <el-alert
              v-if="!vendorLoading && !vendorProfiles.length"
              type="info"
              show-icon
              :closable="false"
              title="还没有厂商档案"
              description="点「新增厂商」把网关地址与 API Key 填进来，保存后即可「设为当前」。"
            />

            <div class="vendor-grid">
              <div
                v-for="vendor in vendorProfiles"
                :key="vendor.id"
                class="vendor-card"
                :class="{ 'is-current': vendor.isCurrent, 'is-off': !vendor.enabled }"
              >
                <div class="vendor-card-head">
                  <div class="vendor-card-title">
                    <strong>{{ vendor.vendor || vendor.id }}</strong>
                    <el-tag v-if="vendor.isCurrent" type="success" size="small" effect="dark">当前使用</el-tag>
                    <el-tag v-else-if="!vendor.enabled" type="info" size="small">已停用</el-tag>
                  </div>
                  <el-switch v-model="vendor.enabled" size="small" @change="handleToggleVendor" />
                </div>

                <div class="vendor-card-body">
                  <div class="vendor-line">
                    <span class="k">协议</span>
                    <span class="v">{{ vendor.protocol === 'ollama' ? '本地 Ollama' : 'OpenAI 兼容' }}</span>
                  </div>
                  <div class="vendor-line">
                    <span class="k">地址</span>
                    <span class="v url">{{ vendor.baseUrl || '-' }}</span>
                  </div>
                  <div class="vendor-line">
                    <span class="k">默认模型</span>
                    <span class="v">{{ vendor.model || '-' }}</span>
                  </div>
                  <div class="vendor-line">
                    <span class="k">API Key</span>
                    <span class="v mono">{{ vendor.apiKey || '未配置' }}</span>
                  </div>
                  <div class="vendor-line">
                    <span class="k">候选模型</span>
                    <span class="v">{{ (vendor.models || []).length }} 个</span>
                  </div>
                </div>

                <el-alert
                  v-if="vendorTestResult[vendor.id]"
                  class="vendor-test-alert"
                  :type="vendorTestResult[vendor.id]?.success ? 'success' : 'error'"
                  :title="vendorTestResult[vendor.id]?.message ?? ''"
                  :description="`耗时 ${vendorTestResult[vendor.id]?.latencyMs ?? 0}ms`"
                  show-icon
                  :closable="false"
                />

                <div class="vendor-card-foot">
                  <el-button
                    size="small"
                    type="primary"
                    :disabled="vendor.isCurrent || !vendor.enabled"
                    @click="handleSetCurrentVendor(vendor)"
                  >
                    {{ vendor.isCurrent ? '当前使用' : '设为当前' }}
                  </el-button>
                  <el-button size="small" :loading="vendorTestingId === vendor.id" @click="handleTestVendor(vendor.id)">
                    测试连通
                  </el-button>
                  <el-button size="small" :loading="vendorPullingId === vendor.id" @click="handlePullVendorModels(vendor.id)">
                    拉取模型
                  </el-button>
                  <el-button size="small" @click="openVendorDialog(vendor)">编辑</el-button>
                  <el-button size="small" type="danger" plain @click="handleDeleteVendor(vendor)">删除</el-button>
                </div>
              </div>
            </div>
          </div>

          <!-- 厂商档案编辑弹窗 -->
          <el-dialog
            v-model="vendorDialogVisible"
            :title="vendorDialogEditing ? '编辑厂商档案' : '新增厂商档案'"
            width="580px"
            append-to-body
          >
            <el-form :model="vendorForm" label-width="110px">
              <el-form-item label="厂商名称">
                <el-input v-model="vendorForm.vendor" placeholder="如：官方 DeepSeek / 中转站 GPT 组" />
              </el-form-item>
              <el-form-item label="协议">
                <el-radio-group v-model="vendorForm.protocol">
                  <el-radio value="openai">OpenAI 兼容</el-radio>
                  <el-radio value="ollama">本地 Ollama</el-radio>
                </el-radio-group>
                <div class="form-tip">DeepSeek / 千问 / 小米 / 火山方舟 / 中转站都选「OpenAI 兼容」。</div>
              </el-form-item>
              <el-form-item label="网关地址">
                <el-input v-model="vendorForm.baseUrl" placeholder="https://api.deepseek.com 或 https://xxx/v1" />
              </el-form-item>
              <el-form-item label="API Key">
                <el-input
                  v-model="vendorForm.apiKey"
                  type="password"
                  show-password
                  placeholder="sk-...（编辑时保留脱敏值或留空 = 不修改）"
                />
              </el-form-item>
              <el-form-item label="默认模型">
                <el-select v-model="vendorForm.model" filterable allow-create default-first-option style="width: 100%" placeholder="填写或从候选里选">
                  <el-option v-for="m in vendorForm.models" :key="m" :label="m" :value="m" />
                </el-select>
              </el-form-item>
              <el-form-item label="候选模型">
                <el-input v-model="vendorModelsText" type="textarea" :rows="4" placeholder="每行一个模型名，可用卡片上的「拉取模型」自动填充" />
                <div class="form-tip">仅用于下拉候选；实际调用哪个由上面的「默认模型」决定。</div>
              </el-form-item>
            </el-form>
            <template #footer>
              <el-button @click="vendorDialogVisible = false">取消</el-button>
              <el-button type="primary" :loading="vendorDialogSaving" @click="handleSaveVendor">保存</el-button>
            </template>
          </el-dialog>
          <!-- ============ [新增结束] ============ -->

          <el-form :model="aiForm" label-width="150px" label-position="right" class="ai-config-form">
            <el-form-item label="智能体提供商">
              <el-radio-group v-model="aiForm.provider" class="provider-radio-group">
                <el-radio value="DEEPSEEK">DeepSeek 直连</el-radio>
                <el-radio value="QIANWEN">通义千问</el-radio>
                <el-radio value="OLLAMA">本地 Ollama</el-radio>
                <el-radio value="DIFY">Dify 工作流</el-radio>
                <el-radio value="HYBRID">混合模式</el-radio>
              </el-radio-group>
              <div class="form-tip">
                DeepSeek：直接调用 DeepSeek API，性能强
                <br />通义千问：阿里云 DashScope 千问大模型，中文效果最佳
                <br />本地 Ollama：使用本机或 WSL 中的模型，不消耗云端 API 配额
                <br />Dify：通过 Dify 编排复杂工作流
                <br />混合模式：分析用直连，出题用工作流
              </div>
            </el-form-item>

            <div class="model-focus-panel">
              <div class="model-focus-copy">
                <div class="model-focus-title">
                  <el-icon><Cpu /></el-icon>
                  <span>当前默认模型</span>
                  <el-tag :type="activeProviderConfigured ? 'success' : 'warning'" size="small">
                    {{ activeProviderConfigured ? '通路已配置' : '待配置' }}
                  </el-tag>
                </div>
                <strong>{{ activeModelLabel }}</strong>
                <span>{{ activeModelDescription }}</span>
              </div>
              <div class="model-focus-meta">
                <span>保存后将用于新建的 AI 请求</span>
                <el-button
                  link
                  type="primary"
                  :loading="modelLoading[aiForm.provider]"
                  :disabled="aiForm.provider === 'DIFY' || aiForm.provider === 'HYBRID'"
                  @click="refreshProviderModels(aiForm.provider)"
                >
                  <el-icon><Refresh /></el-icon>刷新模型
                </el-button>
              </div>
            </div>

            <el-divider content-position="left">DeepSeek 配置</el-divider>

            <el-form-item label="API 地址">
              <el-input v-model="aiForm.deepseekBaseUrl" placeholder="https://api.deepseek.com" />
            </el-form-item>
            <el-form-item label="API Key">
              <el-input
                v-model="aiForm.deepseekApiKey"
                type="password"
                show-password
                placeholder="sk-xxxxxxxxxxxxxxxx"
                style="width: 450px"
              />
              <el-button
                type="primary"
                :loading="testingDS"
                style="margin-left: 10px"
                @click="handleTestDeepSeek"
              >
                测试连接
              </el-button>
            </el-form-item>
            <el-form-item label="默认模型">
              <el-select
                v-model="aiForm.deepseekModel"
                style="width: 320px"
                filterable
                :loading="modelLoading.DEEPSEEK"
                @focus="loadProviderModels('DEEPSEEK')"
              >
                <el-option v-for="model in modelOptionsFor('DEEPSEEK')" :key="model.id" :label="model.name" :value="model.id">
                  <div class="model-option">
                    <div class="model-option-title">
                      <strong>{{ model.name }}</strong>
                      <el-tag v-if="model.id === aiForm.deepseekModel" type="success" size="small">当前</el-tag>
                    </div>
                    <span>{{ model.description }}</span>
                  </div>
                </el-option>
              </el-select>
              <div v-if="modelLoadError.DEEPSEEK" class="model-field-tip warning">{{ modelLoadError.DEEPSEEK }}</div>
            </el-form-item>

            <el-divider content-position="left">通义千问配置</el-divider>

            <el-form-item label="API 地址">
              <el-input v-model="aiForm.qianwenBaseUrl" placeholder="https://dashscope.aliyuncs.com/compatible-mode/v1" />
            </el-form-item>
            <el-form-item label="API Key">
              <el-input
                v-model="aiForm.qianwenApiKey"
                type="password"
                show-password
                placeholder="sk-xxxxxxxxxxxxxxxx"
                style="width: 450px"
              />
              <el-button
                type="primary"
                :loading="testingQW"
                style="margin-left: 10px"
                @click="handleTestQianwen"
              >
                测试连接
              </el-button>
            </el-form-item>
            <el-form-item label="默认模型">
              <el-select
                v-model="aiForm.qianwenModel"
                style="width: 320px"
                filterable
                :loading="modelLoading.QIANWEN"
                @focus="loadProviderModels('QIANWEN')"
              >
                <el-option v-for="model in modelOptionsFor('QIANWEN')" :key="model.id" :label="model.name" :value="model.id">
                  <div class="model-option">
                    <div class="model-option-title">
                      <strong>{{ model.name }}</strong>
                      <el-tag v-if="model.id === aiForm.qianwenModel" type="success" size="small">当前</el-tag>
                    </div>
                    <span>{{ model.description }}</span>
                  </div>
                </el-option>
              </el-select>
              <div v-if="modelLoadError.QIANWEN" class="model-field-tip warning">{{ modelLoadError.QIANWEN }}</div>
            </el-form-item>

            <el-divider content-position="left">本地 Ollama 配置</el-divider>

            <el-form-item label="服务地址">
              <el-input v-model="aiForm.ollamaBaseUrl" placeholder="http://127.0.0.1:11434" />
              <el-button type="primary" plain :loading="testingOllama" @click="handleTestOllama">
                测试服务
              </el-button>
              <div class="form-tip">支持本机或 WSL 中运行的 Ollama 服务。</div>
            </el-form-item>
            <el-form-item label="默认模型">
              <el-select
                v-model="aiForm.ollamaModel"
                style="width: 320px"
                filterable
                allow-create
                default-first-option
                :loading="modelLoading.OLLAMA"
                @focus="loadProviderModels('OLLAMA')"
              >
                <el-option v-for="model in modelOptionsFor('OLLAMA')" :key="model.id" :label="model.name" :value="model.id">
                  <div class="model-option">
                    <div class="model-option-title">
                      <strong>{{ model.name }}</strong>
                      <el-tag v-if="model.id === aiForm.ollamaModel" type="success" size="small">当前</el-tag>
                    </div>
                    <span>{{ model.description }}</span>
                  </div>
                </el-option>
              </el-select>
              <el-button link type="primary" :loading="modelLoading.OLLAMA" @click="refreshProviderModels('OLLAMA')">
                <el-icon><Refresh /></el-icon>刷新模型
              </el-button>
              <div v-if="modelLoadError.OLLAMA" class="model-field-tip warning">{{ modelLoadError.OLLAMA }}</div>
            </el-form-item>

            <el-divider content-position="left">Dify 工作流配置</el-divider>

            <el-form-item label="Dify 地址">
              <el-input v-model="aiForm.difyBaseUrl" placeholder="https://api.dify.ai/v1" />
            </el-form-item>
            <el-form-item label="学情分析 Key">
              <el-input
                v-model="aiForm.difyAnalyzeKey"
                type="password"
                show-password
                placeholder="app-xxxxxxxxxxxxxxxx"
                style="width: 450px"
              />
            </el-form-item>
            <el-form-item label="智能出题 Key">
              <el-input
                v-model="aiForm.difyGenerateKey"
                type="password"
                show-password
                placeholder="app-xxxxxxxxxxxxxxxx"
                style="width: 450px"
              />
            </el-form-item>

            <el-divider content-position="left">通用 AI 参数</el-divider>

            <el-form-item label="温度参数">
              <el-slider v-model="aiForm.temperature" :min="0" :max="2" :step="0.1" style="width: 300px" />
              <span class="form-tip" style="margin-left: 10px">{{ aiForm.temperature }}（0=确定，2=发散）</span>
            </el-form-item>
            <el-form-item label="最大 Token 数">
              <el-input-number v-model="aiForm.maxTokens" :min="256" :max="32768" :step="256" style="width: 180px" />
              <span class="form-tip">token</span>
            </el-form-item>
            <el-form-item label="系统提示词">
              <el-input
                v-model="aiForm.systemPrompt"
                type="textarea"
                :rows="3"
                placeholder="你是一个专业的英语语法教学助手..."
                style="width: 600px"
              />
            </el-form-item>
            <el-form-item label="请求超时">
              <el-input-number v-model="aiForm.timeout" :min="5" :max="120" style="width: 150px" />
              <span class="form-tip">秒</span>
            </el-form-item>
            <el-form-item label="启用 Mock 模式">
              <el-switch v-model="aiForm.mockEnabled" />
              <span class="form-tip" style="margin-left: 10px">未配置 API Key 时返回模拟数据</span>
            </el-form-item>

            <el-form-item>
              <el-button type="primary" :loading="saving" @click="handleSaveAiConfig">
                保存 AI 配置
              </el-button>
            </el-form-item>
          </el-form>
        </el-tab-pane>

        <!-- 接口测试 -->
        <el-tab-pane label="接口测试" name="test">
          <div class="test-section">
            <el-row :gutter="16">
              <el-col :span="8" v-for="provider in providerList" :key="provider.id">
                <el-card class="provider-test-card" shadow="hover">
                  <div class="provider-header">
                    <span class="provider-name">{{ provider.name }}</span>
                    <el-tag :type="provider.configured ? 'success' : 'info'" size="small">
                      {{ provider.configured ? '已配置' : '未配置' }}
                    </el-tag>
                  </div>
                  <div class="provider-info">
                    <div>模型: <strong>{{ provider.model || '-' }}</strong></div>
                    <div>地址: <span class="url-text">{{ provider.baseUrl || '-' }}</span></div>
                    <div>类型: <el-tag size="small" :type="provider.providerType === 'WORKFLOW' ? 'warning' : ''">{{ provider.providerType }}</el-tag></div>
                  </div>
                  <div class="test-result" v-if="testResults[provider.id]">
                    <!-- v-if 已保证该项存在；noUncheckedIndexedAccess 下索引访问为可选，故用可选链 + 兜底值满足类型检查 -->
                    <el-alert
                      :type="testResults[provider.id]?.success ? 'success' : 'error'"
                      :title="testResults[provider.id]?.message ?? ''"
                      :description="`耗时 ${testResults[provider.id]?.latencyMs ?? 0}ms`"
                      show-icon
                      :closable="false"
                    />
                  </div>
                  <el-button
                    type="primary"
                    size="small"
                    :loading="testingProvider === provider.id"
                    @click="handleTestProvider(provider.id)"
                  >
                    {{ testingProvider === provider.id ? '测试中...' : '测试连接' }}
                  </el-button>
                </el-card>
              </el-col>
            </el-row>

            <el-divider content-position="left">自定义测试</el-divider>

            <el-form :model="customTest" label-width="120px" label-position="right" inline>
              <el-form-item label="Provider">
                <el-select v-model="customTest.provider" style="width: 180px">
                  <el-option label="DeepSeek" value="DEEPSEEK" />
                  <el-option label="通义千问" value="QIANWEN" />
                </el-select>
              </el-form-item>
              <el-form-item label="API Key">
                <el-input v-model="customTest.apiKey" placeholder="留空使用配置值" style="width: 250px" show-password />
              </el-form-item>
              <el-form-item label="模型">
                <el-select v-model="customTest.model" style="width: 200px" clearable>
                  <el-option 
                    v-for="m in availableModels" 
                    :key="m.id" 
                    :label="m.name" 
                    :value="m.id"
                  />
                </el-select>
              </el-form-item>
              <el-form-item>
                <el-button type="primary" :loading="customTesting" @click="handleCustomTest">
                  发送测试请求
                </el-button>
              </el-form-item>
            </el-form>
            <div class="test-result" v-if="customTestResult">
              <el-alert
                :type="customTestResult.success ? 'success' : 'error'"
                :title="customTestResult.message"
                :description="`耗时 ${customTestResult.latencyMs}ms${customTestResult.model ? ' | 模型: ' + customTestResult.model : ''}`"
                show-icon
                :closable="false"
              />
            </div>
          </div>
        </el-tab-pane>

        <!-- 一键接口测试 -->
        <el-tab-pane label="一键测试" name="api-test">
          <div class="api-test-section">
            <!-- 控制栏 -->
            <div class="api-test-controls">
              <el-form inline label-width="90px" size="default">
                <el-form-item label="跳过认证">
                  <el-switch v-model="apiTestForm.skipAuth" />
                  <span class="form-tip" style="margin-left: 8px">开启后不注入Token</span>
                </el-form-item>
                <el-form-item label="单接口超时">
                  <el-input-number
                    v-model="apiTestForm.perTimeoutSeconds"
                    :min="5"
                    :max="120"
                    :step="5"
                    style="width: 120px"
                  />
                  <span style="margin-left: 8px">秒</span>
                </el-form-item>
                <el-form-item>
                  <el-button :loading="apiTestDiscovering" @click="handleDiscoverEndpoints">
                    <el-icon><Search /></el-icon> 发现接口
                  </el-button>
                  <el-button
                    type="primary"
                    :loading="apiTestRunning"
                    :disabled="apiTestEndpoints.length === 0 && !apiTestRunning"
                    @click="handleRunAllTests"
                  >
                    <el-icon><VideoPlay /></el-icon> 一键测试
                  </el-button>
                </el-form-item>
              </el-form>
            </div>

            <!-- 汇总卡片 -->
            <el-row :gutter="16" v-if="apiTestSummary" class="api-test-summary">
              <el-col :span="6">
                <el-card shadow="hover" class="summary-card total">
                  <div class="summary-value">{{ apiTestSummary.totalEndpoints }}</div>
                  <div class="summary-label">接口总数</div>
                </el-card>
              </el-col>
              <el-col :span="6">
                <el-card shadow="hover" class="summary-card success">
                  <div class="summary-value">{{ apiTestSummary.successCount }}</div>
                  <div class="summary-label">成功</div>
                </el-card>
              </el-col>
              <el-col :span="6">
                <el-card shadow="hover" class="summary-card failed">
                  <div class="summary-value">{{ apiTestSummary.failedCount }}</div>
                  <div class="summary-label">失败</div>
                </el-card>
              </el-col>
              <el-col :span="6">
                <el-card shadow="hover" class="summary-card latency">
                  <div class="summary-value">{{ (apiTestSummary.totalLatencyMs / 1000).toFixed(2) }}s</div>
                  <div class="summary-label">总耗时</div>
                </el-card>
              </el-col>
            </el-row>

            <!-- 进度条 -->
            <el-progress
              v-if="apiTestRunning"
              :percentage="100"
              status="success"
              :indeterminate="true"
              :duration="2"
              :show-text="false"
              style="margin-bottom: 16px"
            />
            <el-alert
              v-if="apiTestRunning"
              title="正在并发测试所有接口，每个接口独立超时，请耐心等待..."
              type="info"
              :closable="false"
              show-icon
              style="margin-bottom: 16px"
            />

            <!-- 结果过滤 -->
            <div class="api-test-filter" v-if="apiTestSummary">
              <el-radio-group v-model="apiTestFilter" size="small">
                <el-radio-button value="all">全部 ({{ apiTestSummary.results.length }})</el-radio-button>
                <el-radio-button value="success">成功 ({{ apiTestSummary.successCount }})</el-radio-button>
                <el-radio-button value="failed">失败 ({{ apiTestSummary.failedCount }})</el-radio-button>
              </el-radio-group>
              <el-input
                v-model="apiTestSearch"
                placeholder="搜索路径/方法"
                style="width: 240px"
                size="small"
                clearable
              >
                <template #prefix><el-icon><Search /></el-icon></template>
              </el-input>
            </div>

            <!-- 接口发现列表（未测试时） -->
            <div v-if="apiTestEndpoints.length > 0 && !apiTestSummary" class="api-test-endpoints">
              <el-tag type="info" style="margin-bottom: 8px">
                已发现 {{ apiTestEndpoints.length }} 个接口，点击「一键测试」开始测试
              </el-tag>
              <el-table :data="apiTestEndpoints" size="small" max-height="500" stripe>
                <el-table-column label="方法" width="80">
                  <template #default="{ row }">
                    <el-tag :type="methodTagType(row.method)" size="small">{{ row.method }}</el-tag>
                  </template>
                </el-table-column>
                <el-table-column prop="path" label="路径" min-width="200" show-overflow-tooltip />
                <el-table-column prop="summary" label="说明" min-width="180" show-overflow-tooltip />
                <el-table-column prop="tag" label="分组" width="160" show-overflow-tooltip />
              </el-table>
            </div>

            <!-- 测试结果表格 -->
            <el-table
              v-if="apiTestSummary"
              :data="filteredApiTestResults"
              size="small"
              max-height="600"
              stripe
              border
            >
              <el-table-column label="状态" width="70" fixed>
                <template #default="{ row }">
                  <el-tag :type="row.success ? 'success' : 'danger'" size="small">
                    {{ row.success ? '成功' : '失败' }}
                  </el-tag>
                </template>
              </el-table-column>
              <el-table-column label="方法" width="75">
                <template #default="{ row }">
                  <el-tag :type="methodTagType(row.method)" size="small" effect="plain">{{ row.method }}</el-tag>
                </template>
              </el-table-column>
              <el-table-column prop="url" label="路径" min-width="220" show-overflow-tooltip />
              <el-table-column label="HTTP" width="70" align="center">
                <template #default="{ row }">
                  <span :class="statusClass(row.statusCode)">{{ row.statusCode || '-' }}</span>
                </template>
              </el-table-column>
              <el-table-column label="耗时" width="80" align="right">
                <template #default="{ row }">
                  <span :style="{ color: row.latencyMs > 3000 ? '#f56c6c' : '#67c23a' }">
                    {{ row.latencyMs }}ms
                  </span>
                </template>
              </el-table-column>
              <el-table-column label="错误/响应预览" min-width="280">
                <template #default="{ row }">
                  <span v-if="row.error" style="color: #f56c6c">{{ row.error }}</span>
                  <span v-else-if="row.responsePreview" class="response-preview">{{ row.responsePreview }}</span>
                  <span v-else style="color: #c0c4cc">-</span>
                </template>
              </el-table-column>
            </el-table>

            <!-- 空状态 -->
            <el-empty
              v-if="!apiTestSummary && apiTestEndpoints.length === 0 && !apiTestRunning"
              description="点击「发现接口」自动读取 OpenAPI 文档，或直接点击「一键测试」开始"
            />
          </div>
        </el-tab-pane>

        <!-- AI 问答 -->
        <el-tab-pane label="AI 问答" name="chat">
          <div class="chat-section">
            <div class="chat-controls">
              <el-form :model="chatForm" inline label-width="80px" size="default">
                <el-form-item label="Provider">
                  <el-select v-model="chatForm.provider" style="width: 160px">
                    <el-option label="DeepSeek" value="DEEPSEEK" />
                    <el-option label="通义千问" value="QIANWEN" />
                  </el-select>
                </el-form-item>
                <el-form-item label="模型">
                  <el-select v-model="chatForm.model" style="width: 180px" clearable placeholder="使用默认">
                    <el-option 
                      v-for="m in availableModels" 
                      :key="m.id" 
                      :label="m.name" 
                      :value="m.id"
                    />
                  </el-select>
                </el-form-item>
                <el-form-item label="温度">
                  <el-slider v-model="chatForm.temperature" :min="0" :max="2" :step="0.1" style="width: 150px" />
                  <span style="margin-left: 6px">{{ chatForm.temperature }}</span>
                </el-form-item>
                <el-form-item label="模式">
                  <el-radio-group v-model="chatForm.mode">
                    <el-radio value="single">单轮</el-radio>
                    <el-radio value="multi">多轮</el-radio>
                  </el-radio-group>
                </el-form-item>
                <el-form-item>
                  <el-button @click="handleClearChat">清空对话</el-button>
                </el-form-item>
              </el-form>
              <div class="chat-summary-bar">
                <el-tag size="small" type="info">已发送 {{ chatMessageCount }} 条消息</el-tag>
                <el-tag size="small" type="success" v-if="chatForm.mode === 'multi'">多轮对话模式（上下文记忆）</el-tag>
                <el-tag size="small" v-else>单轮对话模式</el-tag>
              </div>
            </div>

            <div class="chat-messages" ref="chatMessagesRef">
              <div v-if="chatMessages.length === 0" class="chat-empty">
                <el-icon :size="48" color="#c0c4cc"><ChatDotRound /></el-icon>
                <p>选择一个 Provider，开始与 AI 对话测试</p>
                <p class="form-tip">支持单轮问答和多轮上下文对话</p>
              </div>
              <div 
                v-for="(msg, idx) in chatMessages" 
                :key="idx" 
                class="chat-message"
                :class="msg.role"
              >
                <div class="msg-avatar">
                  <el-avatar v-if="msg.role === 'user'" :size="32" style="background: #409eff">我</el-avatar>
                  <el-avatar v-else-if="msg.role === 'assistant'" :size="32" style="background: #67c23a">AI</el-avatar>
                  <el-avatar v-else :size="32" style="background: #909399">SYS</el-avatar>
                </div>
                <div class="msg-content">
                  <div class="msg-meta">
                    <span>{{ msg.role === 'user' ? '用户' : msg.role === 'assistant' ? 'AI' : '系统' }}</span>
                    <span v-if="(msg as any).latency" class="msg-latency">{{ (msg as any).latency }}ms</span>
                    <span v-if="(msg as any).model" class="msg-model">{{ (msg as any).model }}</span>
                  </div>
                  <div class="msg-text">{{ msg.content }}</div>
                </div>
              </div>
            </div>

            <div class="chat-input-area">
              <el-input
                v-model="chatForm.message"
                type="textarea"
                :rows="3"
                placeholder="输入要问 AI 的问题，按 Ctrl+Enter 发送；多轮模式下会记住之前的对话上下文"
                @keydown.ctrl.enter="handleSendChat"
              />
              <div class="chat-actions">
                <span class="form-tip">支持 Ctrl+Enter 快捷发送</span>
                <div>
                  <el-button 
                    v-if="chatForm.mode === 'multi'"
                    size="small"
                    @click="handleRollback"
                    :disabled="chatMessages.length < 2"
                  >
                    撤销上一轮
                  </el-button>
                  <el-button 
                    type="primary" 
                    :loading="chatLoading"
                    :disabled="!chatForm.message.trim()"
                    @click="handleSendChat"
                  >
                    发送
                  </el-button>
                </div>
              </div>
            </div>
          </div>
        </el-tab-pane>

        <!-- 系统基础配置 -->
        <el-tab-pane label="系统配置" name="system">
          <el-form :model="systemForm" label-width="150px" label-position="right">
            <el-form-item label="站点名称">
              <el-input v-model="systemForm.siteName" style="width: 350px" />
            </el-form-item>
            <el-form-item label="站点描述">
              <el-input v-model="systemForm.siteDescription" type="textarea" :rows="3" style="width: 500px" />
            </el-form-item>
            <el-form-item label="开放用户注册">
              <el-switch v-model="systemForm.registerEnabled" />
            </el-form-item>
            <el-form-item label="默认注册角色">
              <el-select v-model="systemForm.defaultRole" style="width: 150px">
                <el-option label="学生" value="STUDENT" />
                <el-option label="教师" value="TEACHER" />
                <el-option label="管理员" value="ADMIN" />
              </el-select>
            </el-form-item>
            <el-form-item label="最大登录尝试次数">
              <el-input-number v-model="systemForm.maxLoginAttempts" :min="1" :max="20" style="width: 120px" />
              <span class="form-tip">次</span>
            </el-form-item>
            <el-form-item label="登录锁定时长">
              <el-input-number v-model="systemForm.loginLockDuration" :min="5" :max="120" style="width: 120px" />
              <span class="form-tip">分钟</span>
            </el-form-item>
            <el-form-item label="会话超时时间">
              <el-input-number v-model="systemForm.sessionTimeout" :min="30" :max="480" style="width: 120px" />
              <span class="form-tip">分钟</span>
            </el-form-item>
            <el-form-item label="日志保留天数">
              <el-input-number v-model="systemForm.logRetentionDays" :min="7" :max="365" style="width: 120px" />
              <span class="form-tip">天</span>
            </el-form-item>

            <el-form-item>
              <el-button type="primary" :loading="saving" @click="handleSaveSystemConfig">
                保存系统配置
              </el-button>
            </el-form-item>
          </el-form>
        </el-tab-pane>

        <!-- 安全配置 -->
        <el-tab-pane label="安全配置" name="security">
          <el-form :model="securityForm" label-width="150px" label-position="right">
            <el-divider content-position="left">密码策略</el-divider>

            <el-form-item label="密码最小长度">
              <el-input-number v-model="securityForm.passwordMinLength" :min="6" :max="32" style="width: 100px" />
            </el-form-item>
            <el-form-item label="密码最大长度">
              <el-input-number v-model="securityForm.passwordMaxLength" :min="8" :max="64" style="width: 100px" />
            </el-form-item>
            <el-form-item label="要求大写字母">
              <el-switch v-model="securityForm.passwordRequireUppercase" />
            </el-form-item>
            <el-form-item label="要求小写字母">
              <el-switch v-model="securityForm.passwordRequireLowercase" />
            </el-form-item>
            <el-form-item label="要求数字">
              <el-switch v-model="securityForm.passwordRequireNumber" />
            </el-form-item>
            <el-form-item label="要求特殊字符">
              <el-switch v-model="securityForm.passwordRequireSpecial" />
            </el-form-item>
            <el-form-item label="密码过期天数">
              <el-input-number v-model="securityForm.passwordExpireDays" :min="30" :max="365" style="width: 120px" />
              <span class="form-tip">天（0表示永不过期）</span>
            </el-form-item>
            <el-form-item label="允许使用历史密码">
              <el-switch v-model="securityForm.allowSamePassword" />
            </el-form-item>

            <el-divider content-position="left">访问控制</el-divider>

            <el-form-item label="IP 白名单">
              <el-input v-model="securityForm.ipWhitelist" placeholder="多个IP用逗号分隔，为空则不限制" style="width: 500px" />
            </el-form-item>
            <el-form-item label="强制 HTTPS">
              <el-switch v-model="securityForm.httpsRequired" />
            </el-form-item>

            <el-form-item>
              <el-button type="primary" :loading="saving" @click="handleSaveSecurityConfig">
                保存安全配置
              </el-button>
            </el-form-item>
          </el-form>
        </el-tab-pane>

        <!-- 考试配置 -->
        <el-tab-pane label="考试配置" name="exam">
          <el-form :model="examForm" label-width="150px" label-position="right">
            <el-divider content-position="left">基本设置</el-divider>

            <el-form-item label="默认考试时长">
              <el-input-number v-model="examForm.defaultDuration" :min="5" :max="300" style="width: 120px" />
              <span class="form-tip">分钟</span>
            </el-form-item>
            <el-form-item label="最小题目数量">
              <el-input-number v-model="examForm.minQuestions" :min="5" :max="50" style="width: 100px" />
            </el-form-item>
            <el-form-item label="最大题目数量">
              <el-input-number v-model="examForm.maxQuestions" :min="10" :max="100" style="width: 100px" />
            </el-form-item>
            <el-form-item label="及格分数">
              <el-input-number v-model="examForm.passScore" :min="0" :max="100" style="width: 100px" />
              <span class="form-tip">分</span>
            </el-form-item>

            <el-divider content-position="left">显示设置</el-divider>

            <el-form-item label="提交后显示答案">
              <el-switch v-model="examForm.showAnswerAfterSubmit" />
            </el-form-item>
            <el-form-item label="提交后显示分数">
              <el-switch v-model="examForm.showScoreAfterSubmit" />
            </el-form-item>
            <el-form-item label="显示倒计时">
              <el-switch v-model="examForm.enableTimerDisplay" />
            </el-form-item>

            <el-divider content-position="left">高级设置</el-divider>

            <el-form-item label="最大考试次数">
              <el-input-number v-model="examForm.maxAttempts" :min="0" :max="10" style="width: 100px" />
              <span class="form-tip">次（0表示不限制）</span>
            </el-form-item>
            <el-form-item label="随机题目顺序">
              <el-switch v-model="examForm.randomQuestionOrder" />
            </el-form-item>
            <el-form-item label="随机选项顺序">
              <el-switch v-model="examForm.randomOptionOrder" />
            </el-form-item>
            <el-form-item label="启用自动提交">
              <el-switch v-model="examForm.enableAutoSubmit" />
            </el-form-item>

            <el-form-item>
              <el-button type="primary" :loading="saving" @click="handleSaveExamConfig">
                保存考试配置
              </el-button>
            </el-form-item>
          </el-form>
        </el-tab-pane>

        <!-- 学习配置 -->
        <el-tab-pane label="学习配置" name="learning">
          <el-form :model="learningForm" label-width="150px" label-position="right">
            <el-divider content-position="left">错题本设置</el-divider>

            <el-form-item label="启用错题本">
              <el-switch v-model="learningForm.enableWrongBook" />
            </el-form-item>
            <el-form-item label="错题保留天数">
              <el-input-number v-model="learningForm.wrongBookRetentionDays" :min="7" :max="365" style="width: 120px" />
              <span class="form-tip">天</span>
            </el-form-item>

            <el-divider content-position="left">学习进度</el-divider>

            <el-form-item label="启用进度追踪">
              <el-switch v-model="learningForm.enableProgressTracking" />
            </el-form-item>
            <el-form-item label="每日目标题目数">
              <el-input-number v-model="learningForm.dailyGoalQuestions" :min="1" :max="100" style="width: 100px" />
              <span class="form-tip">题</span>
            </el-form-item>
            <el-form-item label="启用学习统计">
              <el-switch v-model="learningForm.enableStudyStatistics" />
            </el-form-item>

            <el-divider content-position="left">AI 学习辅助</el-divider>

            <el-form-item label="启用 AI 解析">
              <el-switch v-model="learningForm.enableAiExplanation" />
            </el-form-item>
            <el-form-item label="启用相似题目推荐">
              <el-switch v-model="learningForm.enableSimilarQuestions" />
            </el-form-item>
            <el-form-item label="相似题目推荐数量">
              <el-input-number v-model="learningForm.maxSimilarQuestions" :min="1" :max="10" style="width: 100px" />
              <span class="form-tip">道</span>
            </el-form-item>

            <el-form-item>
              <el-button type="primary" :loading="saving" @click="handleSaveLearningConfig">
                保存学习配置
              </el-button>
            </el-form-item>
          </el-form>
        </el-tab-pane>

        <!-- 菜单配置 -->
        <el-tab-pane label="菜单配置" name="menu">
          <el-form :model="menuForm" label-width="150px" label-position="right">
            <el-form-item label="首页仪表盘">
              <el-switch v-model="menuForm.showDashboard" />
            </el-form-item>
            <el-form-item label="考试管理">
              <el-switch v-model="menuForm.showExam" />
            </el-form-item>
            <el-form-item label="练习模块">
              <el-switch v-model="menuForm.showPractice" />
            </el-form-item>
            <el-form-item label="错题本">
              <el-switch v-model="menuForm.showWrongBook" />
            </el-form-item>
            <el-form-item label="统计分析">
              <el-switch v-model="menuForm.showStatistics" />
            </el-form-item>
            <el-form-item label="用户管理">
              <el-switch v-model="menuForm.showUsers" />
            </el-form-item>
            <el-form-item label="系统设置">
              <el-switch v-model="menuForm.showSettings" :disabled="true" />
              <span class="form-tip">（系统保留，不可隐藏）</span>
            </el-form-item>
            <el-form-item label="成绩管理">
              <el-switch v-model="menuForm.showScore" />
            </el-form-item>
            <el-form-item label="操作日志">
              <el-switch v-model="menuForm.showLogs" />
            </el-form-item>
            <el-form-item label="题库管理">
              <el-switch v-model="menuForm.showQuestionBank" />
            </el-form-item>

            <el-form-item>
              <el-button type="primary" :loading="saving" @click="handleSaveMenuConfig">
                保存菜单配置
              </el-button>
            </el-form-item>
          </el-form>
        </el-tab-pane>
      </el-tabs>
    </el-card>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, computed, onMounted, nextTick, watch } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import {
  Setting,
  Tools,
  Refresh,
  ChatDotRound,
  Search,
  VideoPlay,
  Cpu,
  Plus,
} from '@element-plus/icons-vue'
import {
  getAiOverview,
  getConfigsByGroup,
  batchUpdateConfigs,
  refreshConfigs,
  getAiProvidersStatus,
  testAiProvider,
  aiChat,
  aiMultiChat,
  getAiModels,
  discoverEndpoints,
  runAllApiTests,
  getAiVendorProfiles,
  saveAiVendorProfiles,
  setCurrentAiVendor,
  deleteAiVendor,
  fetchAiVendorModels,
  type AiOverview,
  type AiProviderStatus,
  type AiModel,
  type AiTestResult,
  type AiChatMessage,
  type AiVendorProfile,
  type ApiEndpointInfo,
  type ApiTestSummary,
} from '@/api/system'

// 状态
const loading = ref(false)
const saving = ref(false)
const activeTab = ref('ai')

// Provider测试状态
const providerList = ref<AiProviderStatus[]>([])
const testResults = ref<Record<string, AiTestResult>>({})
const testingProvider = ref<string | null>(null)

// 自定义测试
const customTest = reactive({ provider: 'DEEPSEEK', apiKey: '', model: '' })
const customTesting = ref(false)
const customTestResult = ref<AiTestResult | null>(null)

// ==================== [2026-10-16 新增] 多厂商模型档案 ====================
const vendorProfiles = ref<AiVendorProfile[]>([])
const vendorLoading = ref(false)
const vendorDialogVisible = ref(false)
const vendorDialogEditing = ref(false)
const vendorDialogSaving = ref(false)
const vendorTestingId = ref<string | null>(null)
const vendorPullingId = ref<string | null>(null)
const vendorTestResult = ref<Record<string, AiTestResult>>({})
const vendorModelsText = ref('')
const vendorForm = reactive<AiVendorProfile>({
  id: '',
  vendor: '',
  protocol: 'openai',
  baseUrl: '',
  apiKey: '',
  model: '',
  models: [],
  enabled: true,
})

/** 当前生效的厂商档案（后端标记 isCurrent） */
const currentVendor = computed(() => vendorProfiles.value.find(v => v.isCurrent))

const currentVendorLabel = computed(() => {
  if (currentVendor.value) return currentVendor.value.vendor || currentVendor.value.id
  return providerLabels[aiOverview.value.provider] || aiOverview.value.provider
})

const currentVendorModelLabel = computed(() => {
  if (currentVendor.value) return currentVendor.value.model || '-'
  return savedModelLabel.value
})

const loadVendorProfiles = async () => {
  vendorLoading.value = true
  try {
    const res = await getAiVendorProfiles()
    if (res.code === 200 && res.data) vendorProfiles.value = res.data
  } catch (e) {
    console.error('加载厂商档案失败', e)
  } finally {
    vendorLoading.value = false
  }
}

const openVendorDialog = (vendor?: AiVendorProfile) => {
  vendorDialogEditing.value = !!vendor
  if (vendor) {
    Object.assign(vendorForm, {
      id: vendor.id,
      vendor: vendor.vendor,
      protocol: vendor.protocol || 'openai',
      baseUrl: vendor.baseUrl,
      apiKey: vendor.apiKey,
      model: vendor.model,
      models: [...(vendor.models || [])],
      enabled: vendor.enabled !== false,
    })
    vendorModelsText.value = (vendor.models || []).join('\n')
  } else {
    Object.assign(vendorForm, {
      id: '', vendor: '', protocol: 'openai', baseUrl: '', apiKey: '',
      model: '', models: [], enabled: true,
    })
    vendorModelsText.value = ''
  }
  vendorDialogVisible.value = true
}

const parseVendorModels = () =>
  vendorModelsText.value.split('\n').map(s => s.trim()).filter(Boolean)

/** 把当前页面的档案列表整体提交（后端会保留脱敏 Key 对应的旧 Key） */
const persistVendorProfiles = async (list: AiVendorProfile[]) => {
  const res = await saveAiVendorProfiles(list)
  if (res.code === 200) {
    vendorProfiles.value = res.data || []
    return true
  }
  ElMessage.error(res.message || '保存失败')
  return false
}

const handleSaveVendor = async () => {
  if (!vendorForm.vendor.trim()) { ElMessage.warning('请填写厂商名称'); return }
  if (!vendorForm.baseUrl.trim()) { ElMessage.warning('请填写网关地址'); return }
  if (!vendorForm.model.trim()) { ElMessage.warning('请填写默认模型'); return }
  vendorDialogSaving.value = true
  try {
    const payload: AiVendorProfile = { ...vendorForm, models: parseVendorModels() }
    const rest = vendorProfiles.value.filter(v => v.id !== payload.id)
    const ok = await persistVendorProfiles([...rest, payload])
    if (ok) {
      vendorDialogVisible.value = false
      ElMessage.success('厂商档案已保存')
      await loadVendorProfiles()
      await loadAiOverview()
    }
  } catch (e: any) {
    ElMessage.error('保存失败：' + (e.message || '未知错误'))
  } finally {
    vendorDialogSaving.value = false
  }
}

const handleSetCurrentVendor = async (vendor: AiVendorProfile) => {
  try {
    const res = await setCurrentAiVendor(vendor.id)
    if (res.code === 200) {
      ElMessage.success(res.message || '已切换当前模型')
      await loadVendorProfiles()
      await loadAiOverview()
    } else {
      ElMessage.error(res.message || '切换失败')
    }
  } catch (e: any) {
    ElMessage.error('切换失败：' + (e.message || '未知错误'))
  }
}

const handleTestVendor = async (id: string) => {
  vendorTestingId.value = id
  try {
    const res = await testAiProvider(id)
    vendorTestResult.value[id] = res.data
  } catch (e: any) {
    vendorTestResult.value[id] = {
      success: false,
      message: '请求失败：' + (e.message || '未知错误'),
      latencyMs: 0,
    }
  } finally {
    vendorTestingId.value = null
  }
}

const handlePullVendorModels = async (id: string) => {
  vendorPullingId.value = id
  try {
    const res = await fetchAiVendorModels(id)
    if (res.code !== 200) {
      ElMessage.error(res.message || '拉取失败')
      return
    }
    const data = res.data
    const merged = Array.from(
      new Set([...(data.models || []), data.model].filter((m): m is string => !!m))
    )
    const list = vendorProfiles.value.map(v => (v.id === id ? { ...v, models: merged } : v))
    await persistVendorProfiles(list)
    if (data.fromUpstream) {
      ElMessage.success(`已从上游拉取 ${merged.length} 个模型`)
    } else {
      ElMessage.warning(data.message || '上游未返回模型列表')
    }
  } catch (e: any) {
    ElMessage.error('拉取失败：' + (e.message || '未知错误'))
  } finally {
    vendorPullingId.value = null
  }
}

const handleToggleVendor = async () => {
  try {
    await persistVendorProfiles(vendorProfiles.value)
    await loadAiOverview()
  } catch (e: any) {
    ElMessage.error('更新失败：' + (e.message || '未知错误'))
  }
}

const handleDeleteVendor = (vendor: AiVendorProfile) => {
  ElMessageBox.confirm(
    `确定删除厂商档案「${vendor.vendor || vendor.id}」吗？若它正被使用，删除后将回落到内置通路。`,
    '删除确认',
    { type: 'warning', confirmButtonText: '删除', cancelButtonText: '取消' }
  )
    .then(async () => {
      const res = await deleteAiVendor(vendor.id)
      if (res.code === 200) {
        vendorProfiles.value = res.data || []
        delete vendorTestResult.value[vendor.id]
        ElMessage.success('厂商档案已删除')
        await loadAiOverview()
      } else {
        ElMessage.error(res.message || '删除失败')
      }
    })
    .catch(() => { /* 用户取消 */ })
}

// ==================== [新增结束] ====================

// AI 模型列表
const availableModels = ref<AiModel[]>([])
const providerModels = reactive<Record<string, AiModel[]>>({
  DEEPSEEK: [],
  QIANWEN: [],
  OLLAMA: [],
})
const modelLoading = reactive<Record<string, boolean>>({
  DEEPSEEK: false,
  QIANWEN: false,
  OLLAMA: false,
})
const modelLoadError = reactive<Record<string, string>>({
  DEEPSEEK: '',
  QIANWEN: '',
  OLLAMA: '',
})

const fallbackModels: Record<string, AiModel[]> = {
  DEEPSEEK: [
    { id: 'deepseek-v4-pro', name: 'deepseek-v4-pro', description: '最新旗舰模型', provider: 'DEEPSEEK' },
    { id: 'deepseek-v4-flash', name: 'deepseek-v4-flash', description: '高速轻量模型', provider: 'DEEPSEEK' },
    { id: 'deepseek-chat', name: 'deepseek-chat', description: '标准模型', provider: 'DEEPSEEK' },
    { id: 'deepseek-r1', name: 'deepseek-r1', description: '推理模型', provider: 'DEEPSEEK' },
    { id: 'deepseek-reasoner', name: 'deepseek-reasoner', description: '深度推理模型', provider: 'DEEPSEEK' },
  ],
  QIANWEN: [
    { id: 'qwen3.8-flash', name: 'qwen3.8-flash', description: '当前默认模型', provider: 'QIANWEN' },
    { id: 'qwen3.7-max', name: 'qwen3.7-max', description: '最新旗舰模型', provider: 'QIANWEN' },
    { id: 'qwen-max', name: 'qwen-max', description: '旗舰模型', provider: 'QIANWEN' },
    { id: 'qwen-plus', name: 'qwen-plus', description: '增强模型', provider: 'QIANWEN' },
    { id: 'qwen-turbo', name: 'qwen-turbo', description: '快速模型', provider: 'QIANWEN' },
    { id: 'qwen-long', name: 'qwen-long', description: '长上下文模型', provider: 'QIANWEN' },
    { id: 'qwen2.5', name: 'qwen2.5-72b', description: '多模态旗舰', provider: 'QIANWEN' },
    { id: 'qwq-plus', name: 'qwq-plus', description: '推理增强模型', provider: 'QIANWEN' },
  ],
  OLLAMA: [
    { id: 'qwen3.5:9b', name: 'qwen3.5:9b', description: '本地默认模型', provider: 'OLLAMA' },
  ],
}

// AI 概览
const aiOverview = ref<AiOverview>({
  provider: 'DEEPSEEK',
  deepseekConfigured: false,
  difyAnalyzeConfigured: false,
  difyGenerateConfigured: false,
  mockEnabled: true,
  defaultModel: 'deepseek-chat',
  qianwenConfigured: false,
  temperature: 0.7,
  maxTokens: 4096,
})

// AI 表单
const aiForm = reactive({
  provider: 'DEEPSEEK',
  deepseekBaseUrl: 'https://api.deepseek.com',
  deepseekApiKey: '',
  deepseekModel: 'deepseek-chat',
  qianwenBaseUrl: 'https://dashscope.aliyuncs.com/compatible-mode/v1',
  qianwenApiKey: '',
  qianwenModel: 'qwen-max',
  ollamaBaseUrl: 'http://127.0.0.1:11434',
  ollamaModel: 'qwen3.5:9b',
  // [2026-10-16] 19002 被历史遗留 portproxy 抢占，Dify 的 nginx 端口已改 19003（见 README §5.2）
  difyBaseUrl: 'http://localhost:19003/v1',
  difyAnalyzeKey: '',
  difyGenerateKey: '',
  mockEnabled: true,
  temperature: 0.7,
  maxTokens: 4096,
  systemPrompt: '你是一个专业的英语语法教学助手，擅长分析学生的语法错误并提供清晰的讲解。',
  timeout: 30,
})

// 聊天表单
const chatForm = reactive({
  provider: 'DEEPSEEK',
  model: '',
  temperature: 0.7,
  mode: 'single' as 'single' | 'multi',
  message: '',
})
const chatMessages = ref<AiChatMessage[]>([])
const chatLoading = ref(false)
const chatMessagesRef = ref<HTMLElement | null>(null)
const chatMessageCount = computed(() => chatMessages.value.length)

// 一键接口测试状态
const apiTestForm = reactive({ skipAuth: false, perTimeoutSeconds: 30 })
const apiTestDiscovering = ref(false)
const apiTestRunning = ref(false)
const apiTestEndpoints = ref<ApiEndpointInfo[]>([])
const apiTestSummary = ref<ApiTestSummary | null>(null)
const apiTestFilter = ref<'all' | 'success' | 'failed'>('all')
const apiTestSearch = ref('')

const filteredApiTestResults = computed(() => {
  if (!apiTestSummary.value) return []
  let list = apiTestSummary.value.results
  if (apiTestFilter.value === 'success') list = list.filter(r => r.success)
  else if (apiTestFilter.value === 'failed') list = list.filter(r => !r.success)
  if (apiTestSearch.value.trim()) {
    const kw = apiTestSearch.value.trim().toLowerCase()
    list = list.filter(r => r.url.toLowerCase().includes(kw) || r.method.toLowerCase().includes(kw))
  }
  return list
})

const methodTagType = (method: string) => {
  const map: Record<string, string> = { GET: 'success', POST: 'primary', PUT: 'warning', DELETE: 'danger', PATCH: 'info' }
  return (map[method] as any) || ''
}

const statusClass = (code: number) => {
  if (!code) return 'status-na'
  if (code >= 200 && code < 300) return 'status-2xx'
  if (code >= 400 && code < 500) return 'status-4xx'
  if (code >= 500) return 'status-5xx'
  return ''
}

// 系统表单
const systemForm = reactive({
  siteName: 'GramEval 英语语法考试系统',
  siteDescription: '基于AI的智能英语语法评估系统',
  registerEnabled: true,
  defaultRole: 'STUDENT',
  maxLoginAttempts: 5,
  loginLockDuration: 30,
  sessionTimeout: 180,
  logRetentionDays: 90,
})

// 安全表单
const securityForm = reactive({
  passwordMinLength: 8,
  passwordMaxLength: 32,
  passwordRequireUppercase: true,
  passwordRequireLowercase: true,
  passwordRequireNumber: true,
  passwordRequireSpecial: false,
  passwordExpireDays: 90,
  allowSamePassword: false,
  ipWhitelist: '',
  httpsRequired: false,
})

// 考试表单
const examForm = reactive({
  defaultDuration: 60,
  minQuestions: 10,
  maxQuestions: 50,
  passScore: 60,
  showAnswerAfterSubmit: true,
  showScoreAfterSubmit: true,
  maxAttempts: 3,
  randomQuestionOrder: true,
  randomOptionOrder: true,
  enableAutoSubmit: true,
  enableTimerDisplay: true,
})

// 学习表单
const learningForm = reactive({
  enableWrongBook: true,
  wrongBookRetentionDays: 180,
  enableProgressTracking: true,
  dailyGoalQuestions: 10,
  enableAiExplanation: true,
  enableSimilarQuestions: true,
  maxSimilarQuestions: 5,
  enableStudyStatistics: true,
})

// 菜单表单
const menuForm = reactive({
  showDashboard: true,
  showExam: true,
  showPractice: true,
  showWrongBook: true,
  showStatistics: true,
  showUsers: true,
  showSettings: true,
  showScore: true,
  showLogs: true,
  showQuestionBank: true,
})

// 计算属性
const providerLabels: Record<string, string> = {
  DEEPSEEK: 'DeepSeek 直连',
  QIANWEN: '通义千问',
  OLLAMA: '本地 Ollama',
  DIFY: 'Dify 工作流',
  HYBRID: '混合模式',
}

const modelOptionsFor = (provider: string) => {
  const models = providerModels[provider]
  return models?.length ? models : (fallbackModels[provider] || [])
}

const providerLabel = computed(() => {
  return providerLabels[aiOverview.value.provider] || aiOverview.value.provider
})

const providerTagType = computed(() => {
  const map: Record<string, string> = {
    DEEPSEEK: 'primary',
    QIANWEN: 'success',
    OLLAMA: 'info',
    DIFY: 'warning',
    HYBRID: 'info',
  }
  return (map[aiOverview.value.provider] as any) || 'info'
})

// [2026-10-16 注释保留] 概览区已改用「当前厂商档案」currentVendorLabel，此计算属性暂无引用
// const activeProviderLabel = computed(() => providerLabels[aiForm.provider] || aiForm.provider)

const activeModelValue = computed(() => {
  if (aiForm.provider === 'QIANWEN') return aiForm.qianwenModel
  if (aiForm.provider === 'OLLAMA') return aiForm.ollamaModel
  if (aiForm.provider === 'DIFY') return 'workflow'
  if (aiForm.provider === 'HYBRID') return `${aiForm.deepseekModel} + workflow`
  return aiForm.deepseekModel
})

const activeModelMeta = computed(() => {
  if (aiForm.provider === 'DIFY' || aiForm.provider === 'HYBRID') return undefined
  return modelOptionsFor(aiForm.provider).find(model => model.id === activeModelValue.value)
})

const activeModelLabel = computed(() => activeModelValue.value || '未选择模型')

const activeModelDescription = computed(() => {
  if (aiForm.provider === 'DIFY') return '由 Dify 工作流决定具体模型'
  if (aiForm.provider === 'HYBRID') return '分析使用直连模型，出题使用 Dify 工作流'
  return activeModelMeta.value?.description || '自定义模型或暂未加载模型列表'
})

const activeProviderConfigured = computed(() => {
  if (aiForm.provider === 'DEEPSEEK') return aiOverview.value.deepseekConfigured
  if (aiForm.provider === 'QIANWEN') return aiOverview.value.qianwenConfigured ?? false
  if (aiForm.provider === 'OLLAMA') return true
  if (aiForm.provider === 'DIFY') {
    return aiOverview.value.difyAnalyzeConfigured && aiOverview.value.difyGenerateConfigured
  }
  return aiOverview.value.deepseekConfigured || aiOverview.value.qianwenConfigured === true
})

const savedModelLabel = computed(() => {
  const provider = aiOverview.value.provider
  if (provider === 'QIANWEN') return aiOverview.value.qianwenModel || aiOverview.value.defaultModel || '-'
  if (provider === 'DIFY') return '由工作流决定'
  if (provider === 'HYBRID') return `${aiOverview.value.defaultModel || '-'} + 工作流`
  return aiOverview.value.currentModel || aiOverview.value.defaultModel || '-'
})

const loadProviderModels = async (provider: string, force = false) => {
  if (!provider || modelLoading[provider]) return
  if (!force && providerModels[provider]?.length) return

  modelLoading[provider] = true
  modelLoadError[provider] = ''
  try {
    const res = await getAiModels(provider)
    if (res.code !== 200 || !res.data?.length) {
      throw new Error(res.message || '模型列表为空')
    }
    providerModels[provider] = res.data
  } catch (e) {
    if (!providerModels[provider]?.length && fallbackModels[provider]) {
      providerModels[provider] = fallbackModels[provider]
    }
    modelLoadError[provider] = '在线模型列表暂不可用，已显示内置选项'
  } finally {
    modelLoading[provider] = false
  }
}

const refreshProviderModels = async (provider: string) => {
  await loadProviderModels(provider, true)
  if (!modelLoadError[provider]) ElMessage.success('模型列表已刷新')
}

// 监听 Provider 变化，加载对应模型；聊天测试和自定义测试共用同一份模型数据。
watch(() => chatForm.provider, async () => {
  await loadProviderModels(chatForm.provider)
  availableModels.value = modelOptionsFor(chatForm.provider)
}, { immediate: true })

watch(() => customTest.provider, async () => {
  await loadProviderModels(customTest.provider)
  availableModels.value = modelOptionsFor(customTest.provider)
}, { immediate: true })

// 方法
/**
 * 把 sys_config 的 ai 分组配置回填到表单。
 * [2026-09-27 修复] 原来只有 provider / 模型名回填，difyBaseUrl、deepseekBaseUrl、qianwenBaseUrl、
 * temperature、maxTokens、systemPrompt、timeout 一直停留在代码里写死的默认值；而 handleSaveAiConfig
 * 对这些字段是无条件写入 —— 页面上随便点一次「保存 AI 配置」，就把默认值覆盖进 sys_config。
 * 实测影响：Dify 地址原本写死为云端 https://api.dify.ai/v1，保存一次后 DifyClient 就改打云端了。
 * 加密项（各 api_key）回填的是脱敏值 app***xxx：保存时被 !includes('***') 挡住不回写，
 * 后端 updateConfig 遇 *** 也会跳过，双重保险，不会产生双重加密。
 */
const loadAiConfigs = async () => {
  try {
    const res = await getConfigsByGroup('ai')
    if (res.code !== 200 || !res.data) return
    const map = new Map<string, string>()
    for (const c of res.data) map.set(c.configKey, c.configValue ?? '')
    const g = (k: string) => map.get(k) ?? ''
    if (g('ai.dify.base_url')) aiForm.difyBaseUrl = g('ai.dify.base_url')
    if (g('ai.deepseek.base_url')) aiForm.deepseekBaseUrl = g('ai.deepseek.base_url')
    if (g('ai.qianwen.base_url')) aiForm.qianwenBaseUrl = g('ai.qianwen.base_url')
    if (g('ai.ollama.base_url')) aiForm.ollamaBaseUrl = g('ai.ollama.base_url')
    if (g('ai.deepseek.api_key')) aiForm.deepseekApiKey = g('ai.deepseek.api_key')
    if (g('ai.qianwen.api_key')) aiForm.qianwenApiKey = g('ai.qianwen.api_key')
    if (g('ai.dify.analyze_key')) aiForm.difyAnalyzeKey = g('ai.dify.analyze_key')
    if (g('ai.dify.generate_key')) aiForm.difyGenerateKey = g('ai.dify.generate_key')
    if (g('ai.deepseek.model')) aiForm.deepseekModel = g('ai.deepseek.model')
    if (g('ai.qianwen.model')) aiForm.qianwenModel = g('ai.qianwen.model')
    if (g('ai.ollama.model')) aiForm.ollamaModel = g('ai.ollama.model')
    const temperature = Number(g('ai.temperature'))
    if (Number.isFinite(temperature)) aiForm.temperature = temperature
    const maxTokens = Number(g('ai.max_tokens'))
    if (Number.isFinite(maxTokens)) aiForm.maxTokens = maxTokens
    const timeout = Number(g('ai.timeout'))
    if (Number.isFinite(timeout)) aiForm.timeout = timeout
    if (g('ai.system_prompt')) aiForm.systemPrompt = g('ai.system_prompt')
  } catch (e) {
    console.error('加载 AI 配置失败', e)
  }
}

const loadAiOverview = async () => {
  loading.value = true
  try {
    const res = await getAiOverview()
    if (res.code === 200) {
      aiOverview.value = res.data
      aiForm.provider = res.data.provider || 'DEEPSEEK'
      aiForm.mockEnabled = res.data.mockEnabled
      aiForm.deepseekModel = res.data.defaultModel || 'deepseek-chat'
      aiForm.qianwenModel = res.data.qianwenModel || aiForm.qianwenModel
      aiOverview.value.qianwenConfigured = res.data.qianwenConfigured ?? false
      aiOverview.value.temperature = res.data.temperature ?? 0.7
      aiOverview.value.maxTokens = res.data.maxTokens ?? 4096
      
      // 加载配置值到表单
      if (res.data.defaultModel) aiForm.deepseekModel = res.data.defaultModel
      if (res.data.qianwenModel) aiForm.qianwenModel = res.data.qianwenModel

      // 回填 ai 分组其余配置（Dify 地址 / API Key / 温度等），避免保存时把默认值覆盖进库
      await loadAiConfigs()
    }
  } catch (e) {
    console.error('加载 AI 概览失败', e)
  } finally {
    loading.value = false
  }
}

const loadProviderStatus = async () => {
  try {
    const res = await getAiProvidersStatus()
    if (res.code === 200) {
      providerList.value = res.data
    }
  } catch (e) {
    console.error('加载 Provider 状态失败', e)
  }
}

const loadAvailableModels = async () => {
  await Promise.all([
    loadProviderModels('DEEPSEEK'),
    loadProviderModels('QIANWEN'),
    loadProviderModels('OLLAMA'),
  ])
  availableModels.value = modelOptionsFor(customTest.provider)
}

const testingDS = ref(false)
const handleTestDeepSeek = async () => {
  testingDS.value = true
  try {
    const key = aiForm.deepseekApiKey && !aiForm.deepseekApiKey.includes('***')
      ? aiForm.deepseekApiKey
      : undefined
    const payload: { apiKey?: string; model?: string; baseUrl?: string } = {
      model: aiForm.deepseekModel,
      baseUrl: aiForm.deepseekBaseUrl,
    }
    if (key) payload.apiKey = key
    const res = await testAiProvider('DEEPSEEK', payload)
    if (res.data.success) {
      ElMessage.success(`${res.data.message}（耗时 ${res.data.latencyMs}ms）`)
    } else {
      ElMessage.error(res.data.message)
    }
  } catch (e: any) {
    ElMessage.error('连接测试失败：' + (e.message || '未知错误'))
  } finally {
    testingDS.value = false
  }
}

const testingQW = ref(false)
const handleTestQianwen = async () => {
  testingQW.value = true
  try {
    const key = aiForm.qianwenApiKey && !aiForm.qianwenApiKey.includes('***')
      ? aiForm.qianwenApiKey
      : undefined
    if (!key) {
      ElMessage.warning('请先填写通义千问 API Key')
      return
    }
    const res = await testAiProvider('QIANWEN', { apiKey: key })
    if (res.data.success) {
      ElMessage.success(`${res.data.message}（耗时 ${res.data.latencyMs}ms）`)
    } else {
      ElMessage.error(res.data.message)
    }
  } catch (e: any) {
    ElMessage.error('连接测试失败：' + (e.message || '未知错误'))
  } finally {
    testingQW.value = false
  }
}

const testingOllama = ref(false)
const handleTestOllama = async () => {
  testingOllama.value = true
  try {
    const res = await testAiProvider('OLLAMA', {
      model: aiForm.ollamaModel,
      baseUrl: aiForm.ollamaBaseUrl,
    })
    if (res.data.success) {
      ElMessage.success(`${res.data.message}（耗时 ${res.data.latencyMs}ms）`)
    } else {
      ElMessage.error(res.data.message)
    }
  } catch (e: any) {
    ElMessage.error('服务测试失败：' + (e.message || '未知错误'))
  } finally {
    testingOllama.value = false
  }
}

const handleTestProvider = async (providerId: string) => {
  testingProvider.value = providerId
  try {
    const res = await testAiProvider(providerId)
    testResults.value[providerId] = res.data
  } catch (e: any) {
    testResults.value[providerId] = {
      success: false,
      message: '请求失败：' + (e.message || '未知错误'),
      latencyMs: 0,
    }
  } finally {
    testingProvider.value = null
  }
}

const handleCustomTest = async () => {
  customTesting.value = true
  customTestResult.value = null
  try {
    const payload: { apiKey?: string; model?: string; baseUrl?: string } = {}
    if (customTest.apiKey && !customTest.apiKey.includes('***')) {
      payload.apiKey = customTest.apiKey
    }
    if (customTest.model) {
      payload.model = customTest.model
    }
    const res = await testAiProvider(customTest.provider, payload)
    customTestResult.value = res.data
  } catch (e: any) {
    customTestResult.value = {
      success: false,
      message: '请求失败：' + (e.message || '未知错误'),
      latencyMs: 0,
    }
  } finally {
    customTesting.value = false
  }
}

const handleRefresh = async () => {
  try {
    const res = await refreshConfigs()
    if (res.code === 200) {
      ElMessage.success('配置缓存已刷新')
      await loadAiOverview()
      await loadProviderStatus()
    }
  } catch (e) {
    ElMessage.error('刷新失败')
  }
}

const handleClearChat = () => {
  chatMessages.value = []
}

const handleRollback = () => {
  if (chatMessages.value.length >= 2) {
    chatMessages.value.splice(chatMessages.value.length - 2, 2)
  }
}

const handleSendChat = async () => {
  if (!chatForm.message.trim()) return
  
  const userMsg: AiChatMessage = { role: 'user', content: chatForm.message }
  chatMessages.value.push(userMsg)
  const userInput = chatForm.message
  chatForm.message = ''
  chatLoading.value = true
  
  await nextTick()
  scrollChatToBottom()
  
  try {
    let res
    
    if (chatForm.mode === 'multi') {
      const history = chatMessages.value.map(m => ({ role: m.role, content: m.content }))
      res = await aiMultiChat({
        provider: chatForm.provider,
        messages: history,
        systemPrompt: aiForm.systemPrompt,
      })
    } else {
      res = await aiChat({
        provider: chatForm.provider,
        message: userInput,
        systemPrompt: aiForm.systemPrompt,
        model: chatForm.model || undefined,
        temperature: chatForm.temperature,
        maxTokens: aiForm.maxTokens,
      })
    }
    
    if (res.data.success) {
      const assistantMsg: any = {
        role: 'assistant',
        content: res.data.content,
        latency: res.data.latencyMs,
        model: res.data.model,
      }
      chatMessages.value.push(assistantMsg)
    } else {
      chatMessages.value.push({
        role: 'assistant',
        content: '❌ ' + (res.data.message || '调用失败'),
      })
    }
  } catch (e: any) {
    chatMessages.value.push({
      role: 'assistant',
      content: '❌ 请求异常：' + (e.message || '未知错误'),
    })
  } finally {
    chatLoading.value = false
    await nextTick()
    scrollChatToBottom()
  }
}

const scrollChatToBottom = () => {
  if (chatMessagesRef.value) {
    chatMessagesRef.value.scrollTop = chatMessagesRef.value.scrollHeight
  }
}

const handleSaveAiConfig = async () => {
  saving.value = true
  try {
    const configs: Record<string, string> = {
      'ai.provider': aiForm.provider,
      'ai.deepseek.base_url': aiForm.deepseekBaseUrl,
      'ai.deepseek.model': aiForm.deepseekModel,
      'ai.deepseek.timeout': String(aiForm.timeout),
      'ai.qianwen.base_url': aiForm.qianwenBaseUrl,
      'ai.qianwen.model': aiForm.qianwenModel,
      'ai.ollama.base_url': aiForm.ollamaBaseUrl,
      'ai.ollama.model': aiForm.ollamaModel,
      'ai.dify.base_url': aiForm.difyBaseUrl,
      'ai.mock_enabled': String(aiForm.mockEnabled),
      'ai.temperature': String(aiForm.temperature),
      'ai.max_tokens': String(aiForm.maxTokens),
      'ai.system_prompt': aiForm.systemPrompt,
    }

    if (aiForm.deepseekApiKey && !aiForm.deepseekApiKey.includes('***')) {
      configs['ai.deepseek.api_key'] = aiForm.deepseekApiKey
    }
    if (aiForm.qianwenApiKey && !aiForm.qianwenApiKey.includes('***')) {
      configs['ai.qianwen.api_key'] = aiForm.qianwenApiKey
    }
    if (aiForm.difyAnalyzeKey && !aiForm.difyAnalyzeKey.includes('***')) {
      configs['ai.dify.analyze_key'] = aiForm.difyAnalyzeKey
    }
    if (aiForm.difyGenerateKey && !aiForm.difyGenerateKey.includes('***')) {
      configs['ai.dify.generate_key'] = aiForm.difyGenerateKey
    }

    const res = await batchUpdateConfigs(configs)
    if (res.code === 200) {
      ElMessage.success('AI 配置已保存')
      await loadAiOverview()
      await loadProviderStatus()
    }
  } catch (e) {
    ElMessage.error('保存失败')
  } finally {
    saving.value = false
  }
}

const handleSaveSystemConfig = async () => {
  saving.value = true
  try {
    const configs: Record<string, string> = {
      'system.site_name': systemForm.siteName,
      'system.site_description': systemForm.siteDescription,
      'system.register_enabled': String(systemForm.registerEnabled),
      'system.default_role': systemForm.defaultRole,
      'system.max_login_attempts': String(systemForm.maxLoginAttempts),
      'system.login_lock_duration': String(systemForm.loginLockDuration),
      'system.session_timeout': String(systemForm.sessionTimeout),
      'system.log_retention_days': String(systemForm.logRetentionDays),
    }
    const res = await batchUpdateConfigs(configs)
    if (res.code === 200) {
      ElMessage.success('系统配置已保存')
    }
  } catch (e) {
    ElMessage.error('保存失败')
  } finally {
    saving.value = false
  }
}

const handleSaveSecurityConfig = async () => {
  saving.value = true
  try {
    const configs: Record<string, string> = {
      'security.password_min_length': String(securityForm.passwordMinLength),
      'security.password_max_length': String(securityForm.passwordMaxLength),
      'security.password_require_uppercase': String(securityForm.passwordRequireUppercase),
      'security.password_require_lowercase': String(securityForm.passwordRequireLowercase),
      'security.password_require_number': String(securityForm.passwordRequireNumber),
      'security.password_require_special': String(securityForm.passwordRequireSpecial),
      'security.password_expire_days': String(securityForm.passwordExpireDays),
      'security.allow_same_password': String(securityForm.allowSamePassword),
      'security.ip_whitelist': securityForm.ipWhitelist,
      'security.https_required': String(securityForm.httpsRequired),
    }
    const res = await batchUpdateConfigs(configs)
    if (res.code === 200) {
      ElMessage.success('安全配置已保存')
    }
  } catch (e) {
    ElMessage.error('保存失败')
  } finally {
    saving.value = false
  }
}

const handleSaveExamConfig = async () => {
  saving.value = true
  try {
    const configs: Record<string, string> = {
      'exam.default_duration': String(examForm.defaultDuration),
      'exam.min_questions': String(examForm.minQuestions),
      'exam.max_questions': String(examForm.maxQuestions),
      'exam.pass_score': String(examForm.passScore),
      'exam.show_answer_after_submit': String(examForm.showAnswerAfterSubmit),
      'exam.show_score_after_submit': String(examForm.showScoreAfterSubmit),
      'exam.max_attempts': String(examForm.maxAttempts),
      'exam.random_question_order': String(examForm.randomQuestionOrder),
      'exam.random_option_order': String(examForm.randomOptionOrder),
      'exam.enable_auto_submit': String(examForm.enableAutoSubmit),
      'exam.enable_timer_display': String(examForm.enableTimerDisplay),
    }
    const res = await batchUpdateConfigs(configs)
    if (res.code === 200) {
      ElMessage.success('考试配置已保存')
    }
  } catch (e) {
    ElMessage.error('保存失败')
  } finally {
    saving.value = false
  }
}

const handleSaveLearningConfig = async () => {
  saving.value = true
  try {
    const configs: Record<string, string> = {
      'learning.enable_wrong_book': String(learningForm.enableWrongBook),
      'learning.wrong_book_retention_days': String(learningForm.wrongBookRetentionDays),
      'learning.enable_progress_tracking': String(learningForm.enableProgressTracking),
      'learning.daily_goal_questions': String(learningForm.dailyGoalQuestions),
      'learning.enable_ai_explanation': String(learningForm.enableAiExplanation),
      'learning.enable_similar_questions': String(learningForm.enableSimilarQuestions),
      'learning.max_similar_questions': String(learningForm.maxSimilarQuestions),
      'learning.enable_study_statistics': String(learningForm.enableStudyStatistics),
    }
    const res = await batchUpdateConfigs(configs)
    if (res.code === 200) {
      ElMessage.success('学习配置已保存')
    }
  } catch (e) {
    ElMessage.error('保存失败')
  } finally {
    saving.value = false
  }
}

const handleSaveMenuConfig = async () => {
  saving.value = true
  try {
    const configs: Record<string, string> = {
      'menu.show_dashboard': String(menuForm.showDashboard),
      'menu.show_exam': String(menuForm.showExam),
      'menu.show_practice': String(menuForm.showPractice),
      'menu.show_wrong_book': String(menuForm.showWrongBook),
      'menu.show_statistics': String(menuForm.showStatistics),
      'menu.show_users': String(menuForm.showUsers),
      'menu.show_score': String(menuForm.showScore),
      'menu.show_logs': String(menuForm.showLogs),
      'menu.show_question_bank': String(menuForm.showQuestionBank),
    }
    const res = await batchUpdateConfigs(configs)
    if (res.code === 200) {
      ElMessage.success('菜单配置已保存')
    }
  } catch (e) {
    ElMessage.error('保存失败')
  } finally {
    saving.value = false
  }
}

// ==================== 一键接口测试 ====================

const handleDiscoverEndpoints = async () => {
  apiTestDiscovering.value = true
  try {
    const res = await discoverEndpoints()
    if (res.code === 200) {
      apiTestEndpoints.value = res.data || []
      apiTestSummary.value = null
      ElMessage.success(`已发现 ${apiTestEndpoints.value.length} 个接口`)
    } else {
      ElMessage.error(res.message || '发现接口失败')
    }
  } catch (e: any) {
    ElMessage.error('发现接口失败: ' + (e?.message || '未知错误'))
  } finally {
    apiTestDiscovering.value = false
  }
}

const handleRunAllTests = async () => {
  apiTestRunning.value = true
  apiTestSummary.value = null
  try {
    const res = await runAllApiTests({
      skipAuth: apiTestForm.skipAuth,
      perTimeoutSeconds: apiTestForm.perTimeoutSeconds,
    })
    if (res.code === 200 && res.data) {
      apiTestSummary.value = res.data
      const s = res.data
      ElMessage.success(`测试完成：${s.successCount} 成功 / ${s.failedCount} 失败，共 ${s.totalEndpoints} 个接口`)
    } else {
      ElMessage.error(res.message || '一键测试失败')
    }
  } catch (e: any) {
    ElMessage.error('一键测试请求失败: ' + (e?.message || '未知错误'))
  } finally {
    apiTestRunning.value = false
  }
}

onMounted(async () => {
  await loadAiOverview()
  await loadVendorProfiles()
  await loadProviderStatus()
  await loadAvailableModels()
})
</script>

<style scoped>
.system-settings {
  width: min(100%, 1440px);
  margin: 0 auto;
  padding: 20px;
}

.overview-card {
  margin-bottom: 20px;
}

.card-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  font-weight: 600;
  font-size: 16px;
}

.card-header span {
  display: flex;
  align-items: center;
  gap: 8px;
}

.form-tip {
  color: #909399;
  font-size: 12px;
  line-height: 1.6;
  margin-top: 4px;
}

.overview-model {
  color: #303133;
  font-family: 'SFMono-Regular', Consolas, 'Liberation Mono', monospace;
  font-size: 13px;
  font-weight: 600;
}

.ai-config-intro {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 24px;
  padding: 18px 20px;
  margin-bottom: 18px;
  border: 1px solid #dfe8f5;
  border-left: 4px solid #409eff;
  border-radius: 8px;
  background: #f7faff;
}

.section-kicker {
  color: #409eff;
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.08em;
  line-height: 1.4;
  text-transform: uppercase;
}

.ai-config-intro h3 {
  margin: 3px 0 4px;
  color: #303133;
  font-size: 18px;
  line-height: 1.4;
}

.ai-config-intro p {
  margin: 0;
  color: #606266;
  font-size: 13px;
}

.active-model-summary {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 3px;
  min-width: 180px;
  padding-left: 18px;
  border-left: 1px solid #dfe8f5;
  color: #303133;
}

.active-model-summary .summary-label,
.model-focus-meta {
  color: #909399;
  font-size: 12px;
}

.active-model-summary .summary-model {
  color: #409eff;
  font-family: 'SFMono-Regular', Consolas, 'Liberation Mono', monospace;
  font-size: 12px;
}

/* ============ [2026-10-16 新增] 多厂商模型档案 样式 ============ */
.vendor-manager {
  padding: 18px 20px 20px;
  margin-bottom: 18px;
  border: 1px solid #dfe8f5;
  border-radius: 8px;
  background: #fbfdff;
}

.vendor-manager-head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 24px;
  margin-bottom: 16px;
}

.vendor-manager-head h3 {
  margin: 3px 0 4px;
  color: #303133;
  font-size: 18px;
  line-height: 1.4;
}

.vendor-manager-head p {
  margin: 0;
  max-width: 720px;
  color: #606266;
  font-size: 13px;
  line-height: 1.6;
}

.vendor-manager-actions {
  display: flex;
  flex-shrink: 0;
  gap: 8px;
}

.vendor-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
  gap: 14px;
  margin-top: 14px;
}

.vendor-card {
  display: flex;
  flex-direction: column;
  padding: 14px 16px 12px;
  border: 1px solid #e4ebf5;
  border-radius: 8px;
  background: #fff;
  box-shadow: 0 1px 3px rgba(64, 158, 255, 0.06);
  transition: box-shadow 0.2s ease, transform 0.2s ease, border-color 0.2s ease;
}

.vendor-card:hover {
  border-color: #c6dcf8;
  box-shadow: 0 6px 16px rgba(64, 158, 255, 0.14);
  transform: translateY(-2px);
}

.vendor-card.is-current {
  border-color: #67c23a;
  background: linear-gradient(180deg, #f6fff0 0%, #ffffff 60%);
}

.vendor-card.is-off {
  opacity: 0.62;
}

.vendor-card-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  padding-bottom: 10px;
  border-bottom: 1px dashed #eaeff7;
}

.vendor-card-title {
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
}

.vendor-card-title strong {
  overflow: hidden;
  color: #303133;
  font-size: 14px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.vendor-card-body {
  display: flex;
  flex-direction: column;
  gap: 7px;
  padding: 10px 0 4px;
}

.vendor-line {
  display: flex;
  align-items: baseline;
  gap: 10px;
  font-size: 12.5px;
}

.vendor-line .k {
  flex-shrink: 0;
  width: 62px;
  color: #909399;
}

.vendor-line .v {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  color: #303133;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.vendor-line .v.url {
  color: #606266;
}

.vendor-line .v.mono {
  font-family: 'SFMono-Regular', Consolas, 'Liberation Mono', monospace;
  color: #606266;
}

.vendor-test-alert {
  margin: 6px 0 8px;
}

.vendor-card-foot {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  padding-top: 10px;
  margin-top: auto;
  border-top: 1px dashed #eaeff7;
}

.vendor-card-foot .el-button + .el-button {
  margin-left: 0;
}
/* ============ [新增结束] ============ */

.provider-radio-group {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.provider-radio-group :deep(.el-radio) {
  height: auto;
  margin-right: 0;
  padding: 8px 14px;
  border: 1px solid #dcdfe6;
  border-radius: 6px;
  background: #fff;
  transition: border-color 0.2s ease, color 0.2s ease, background-color 0.2s ease;
}

.provider-radio-group :deep(.el-radio.is-checked) {
  border-color: #409eff;
  background: #ecf5ff;
}

.provider-radio-group :deep(.el-radio__input) {
  display: none;
}

.provider-radio-group :deep(.el-radio__label) {
  padding-left: 0;
  color: #606266;
}

.provider-radio-group :deep(.el-radio.is-checked .el-radio__label) {
  color: #1677c8;
  font-weight: 600;
}

.model-focus-panel {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 18px;
  margin: 2px 0 22px 150px;
  padding: 14px 16px;
  border: 1px solid #dbe5f1;
  border-left: 3px solid #409eff;
  border-radius: 8px;
  background: #f7faff;
}

.model-focus-copy {
  display: flex;
  flex-direction: column;
  gap: 3px;
  min-width: 0;
}

.model-focus-title,
.model-option-title {
  display: flex;
  align-items: center;
  gap: 7px;
}

.model-focus-title {
  color: #606266;
  font-size: 12px;
}

.model-focus-copy > strong {
  overflow: hidden;
  color: #303133;
  font-family: 'SFMono-Regular', Consolas, 'Liberation Mono', monospace;
  font-size: 15px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.model-focus-copy > span {
  color: #909399;
  font-size: 12px;
}

.model-focus-meta {
  display: flex;
  flex-shrink: 0;
  align-items: center;
  gap: 12px;
}

.model-option {
  display: flex;
  flex-direction: column;
  gap: 3px;
  line-height: 1.35;
}

.model-option-title strong {
  color: #303133;
  font-family: 'SFMono-Regular', Consolas, 'Liberation Mono', monospace;
  font-size: 13px;
}

.model-option > span {
  color: #909399;
  font-size: 12px;
}

.model-field-tip.warning {
  margin-top: 4px;
  color: #b88230;
  font-size: 12px;
}

.el-tabs {
  margin-top: 10px;
}

.el-form-item {
  margin-bottom: 20px;
}

.el-divider {
  margin: 24px 0;
}

/* Provider测试卡片 */
.test-section {
  padding: 10px 0;
}

.provider-test-card {
  text-align: center;
  margin-bottom: 16px;
}

.provider-test-card .provider-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 12px;
}

.provider-test-card .provider-name {
  font-weight: 600;
  font-size: 15px;
}

.provider-test-card .provider-info {
  text-align: left;
  margin-bottom: 12px;
  font-size: 13px;
  color: #606266;
  line-height: 1.8;
}

.provider-test-card .url-text {
  display: inline-block;
  max-width: 180px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  vertical-align: middle;
}

.provider-test-card .test-result {
  margin-bottom: 12px;
  text-align: left;
}

/* 聊天界面 */
.chat-section {
  display: flex;
  flex-direction: column;
  height: 600px;
}

.chat-controls {
  padding: 10px 0;
  border-bottom: 1px solid #ebeef5;
  margin-bottom: 10px;
}

.chat-messages {
  flex: 1;
  overflow-y: auto;
  padding: 10px;
  background: #f5f7fa;
  border-radius: 8px;
  margin-bottom: 10px;
}

.chat-empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 100%;
  color: #909399;
}

.chat-empty p {
  margin-top: 16px;
}

.chat-message {
  display: flex;
  gap: 12px;
  margin-bottom: 16px;
}

.chat-message.user {
  flex-direction: row-reverse;
}

.chat-message .msg-avatar {
  flex-shrink: 0;
}

.chat-message .msg-content {
  max-width: 70%;
}

.chat-message.user .msg-content {
  text-align: right;
}

.chat-message .msg-meta {
  font-size: 12px;
  color: #909399;
  margin-bottom: 4px;
  display: flex;
  gap: 8px;
  justify-content: flex-start;
}

.chat-message.user .msg-meta {
  justify-content: flex-end;
}

.chat-message .msg-latency {
  color: #c0c4cc;
}

.chat-message .msg-text {
  background: #fff;
  padding: 12px 16px;
  border-radius: 12px;
  line-height: 1.6;
  white-space: pre-wrap;
  word-break: break-word;
  text-align: left;
}

.chat-message.user .msg-text {
  background: #409eff;
  color: #fff;
}

.chat-input-area {
  border-top: 1px solid #ebeef5;
  padding-top: 10px;
}

.chat-actions {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-top: 8px;
}

.chat-summary-bar {
  display: flex;
  gap: 8px;
  margin-top: 8px;
}

.chat-message .msg-model {
  color: #409eff;
  font-weight: 500;
}

/* 一键接口测试 */
.api-test-section {
  padding: 10px 0;
}

.api-test-controls {
  margin-bottom: 20px;
}

.api-test-summary {
  margin-bottom: 20px;
}

.api-test-summary .summary-card {
  text-align: center;
  padding: 10px 0;
}

.api-test-summary .summary-value {
  font-size: 28px;
  font-weight: 700;
  line-height: 1.4;
}

.api-test-summary .summary-label {
  font-size: 13px;
  color: #909399;
  margin-top: 4px;
}

.api-test-summary .summary-card.total .summary-value {
  color: #409eff;
}

.api-test-summary .summary-card.success .summary-value {
  color: #67c23a;
}

.api-test-summary .summary-card.failed .summary-value {
  color: #f56c6c;
}

.api-test-summary .summary-card.latency .summary-value {
  color: #e6a23c;
}

.api-test-filter {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 12px;
}

.api-test-endpoints {
  margin-top: 10px;
}

.response-preview {
  display: inline-block;
  max-width: 100%;
  color: #606266;
  font-size: 12px;
  font-family: monospace;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.status-2xx {
  color: #67c23a;
  font-weight: 600;
}

.status-4xx {
  color: #e6a23c;
  font-weight: 600;
}

.status-5xx {
  color: #f56c6c;
  font-weight: 600;
}

.status-na {
  color: #c0c4cc;
}

@media (max-width: 900px) {
  .system-settings {
    padding: 14px;
  }

  .ai-config-intro,
  .model-focus-panel {
    align-items: stretch;
    flex-direction: column;
  }

  .active-model-summary {
    align-items: flex-start;
    min-width: 0;
    padding: 12px 0 0;
    border-top: 1px solid #dfe8f5;
    border-left: 0;
  }

  .model-focus-panel {
    margin-left: 0;
  }

  .model-focus-meta {
    align-items: flex-start;
    flex-direction: column;
    gap: 4px;
  }

  .ai-config-form :deep(.el-form-item__content) {
    flex-wrap: wrap;
  }

  .ai-config-form :deep(.el-input),
  .ai-config-form :deep(.el-textarea),
  .ai-config-form :deep(.el-select),
  .ai-config-form :deep(.el-input-number) {
    max-width: 100%;
  }
}

@media (max-width: 640px) {
  .system-settings :deep(.el-descriptions) {
    --el-descriptions-table-border: 1px solid #ebeef5;
  }

  .system-settings :deep(.el-descriptions__body .el-descriptions__table) {
    table-layout: fixed;
  }

  .provider-radio-group :deep(.el-radio) {
    flex: 1 1 100%;
  }
}
</style>
