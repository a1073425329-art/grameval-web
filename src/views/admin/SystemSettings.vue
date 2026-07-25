<template>
  <div class="system-settings">
    <el-card class="overview-card">
      <template #header>
        <div class="card-header">
          <span><el-icon><Setting /></el-icon> 系统设置</span>
        </div>
      </template>

      <!-- AI 配置概览 -->
      <div class="ai-overview">
        <el-descriptions :column="3" border size="default">
          <el-descriptions-item label="当前智能体">
            <el-tag :type="providerTagType" size="default">{{ providerLabel }}</el-tag>
          </el-descriptions-item>
          <el-descriptions-item label="DeepSeek">
            <el-tag :type="aiOverview.deepseekConfigured ? 'success' : 'info'" size="small">
              {{ aiOverview.deepseekConfigured ? '已配置' : '未配置' }}
            </el-tag>
          </el-descriptions-item>
          <el-descriptions-item label="Dify 工作流">
            <el-tag :type="aiOverview.difyAnalyzeConfigured && aiOverview.difyGenerateConfigured ? 'success' : 'info'" size="small">
              {{ aiOverview.difyAnalyzeConfigured && aiOverview.difyGenerateConfigured ? '已配置' : '未配置' }}
            </el-tag>
          </el-descriptions-item>
          <el-descriptions-item label="默认模型">
            {{ aiOverview.defaultModel || '-' }}
          </el-descriptions-item>
          <el-descriptions-item label="Mock 模式">
            <el-tag :type="aiOverview.mockEnabled ? 'warning' : 'success'" size="small">
              {{ aiOverview.mockEnabled ? '已启用' : '已关闭' }}
            </el-tag>
          </el-descriptions-item>
          <el-descriptions-item label="可用场景">
            {{ enabledScenarios }} 个
          </el-descriptions-item>
        </el-descriptions>
      </div>
    </el-card>

    <!-- AI 智能体配置 -->
    <el-card class="config-card">
      <template #header>
        <div class="card-header">
          <span><el-icon><Cpu /></el-icon> AI 智能体配置</span>
        </div>
      </template>

      <el-form :model="aiForm" label-width="140px" label-position="right">
        <!-- 智能体提供商选择 -->
        <el-form-item label="智能体提供商">
          <el-radio-group v-model="aiForm.provider">
            <el-radio value="DEEPSEEK">DeepSeek 直连</el-radio>
            <el-radio value="DIFY">Dify 工作流</el-radio>
            <el-radio value="HYBRID">混合模式</el-radio>
          </el-radio-group>
          <div class="form-tip">
            DeepSeek 直连：直接调用 DeepSeek API，响应快，适合分析类场景
            <br />
            Dify 工作流：通过 Dify 编排复杂流程，适合智能出题等多步骤场景
            <br />
            混合模式：分析用 DeepSeek，出题用 Dify
          </div>
        </el-form-item>

        <el-divider />

        <!-- DeepSeek 配置 -->
        <div class="config-section">
          <h4>DeepSeek 配置</h4>
          <el-form-item label="API 地址">
            <el-input v-model="aiForm.deepseekBaseUrl" placeholder="https://api.deepseek.com" />
          </el-form-item>
          <el-form-item label="API Key">
            <el-input
              v-model="aiForm.deepseekApiKey"
              type="password"
              show-password
              placeholder="sk-xxxxxxxxxxxxxxxx"
              style="width: 400px"
            />
            <el-button
              type="primary"
              :loading="testingConnection"
              style="margin-left: 10px"
              @click="handleTestDeepSeek"
            >
              测试连接
            </el-button>
          </el-form-item>
          <el-form-item label="默认模型">
            <el-select v-model="aiForm.deepseekModel" style="width: 200px">
              <el-option label="deepseek-chat (v4 pro)" value="deepseek-chat" />
              <el-option label="deepseek-reasoner (推理)" value="deepseek-reasoner" />
            </el-select>
          </el-form-item>
        </div>

        <el-divider />

        <!-- Dify 配置 -->
        <div class="config-section">
          <h4>Dify 工作流配置</h4>
          <el-form-item label="Dify 地址">
            <el-input v-model="aiForm.difyBaseUrl" placeholder="https://api.dify.ai/v1" />
          </el-form-item>
          <el-form-item label="学情分析 Key">
            <el-input
              v-model="aiForm.difyAnalyzeKey"
              type="password"
              show-password
              placeholder="app-xxxxxxxxxxxxxxxx"
              style="width: 400px"
            />
          </el-form-item>
          <el-form-item label="智能出题 Key">
            <el-input
              v-model="aiForm.difyGenerateKey"
              type="password"
              show-password
              placeholder="app-xxxxxxxxxxxxxxxx"
              style="width: 400px"
            />
          </el-form-item>
        </div>

        <el-divider />

        <el-form-item label="启用 Mock 模式">
          <el-switch v-model="aiForm.mockEnabled" />
          <span class="form-tip" style="margin-left: 10px">
            未配置 API Key 时返回模拟数据，便于开发测试
          </span>
        </el-form-item>

        <el-form-item>
          <el-button type="primary" :loading="saving" @click="handleSaveAiConfig">
            保存 AI 配置
          </el-button>
        </el-form-item>
      </el-form>
    </el-card>

    <!-- 系统基础配置 -->
    <el-card class="config-card">
      <template #header>
        <div class="card-header">
          <span><el-icon><Tools /></el-icon> 系统基础配置</span>
        </div>
      </template>

      <el-form :model="systemForm" label-width="140px" label-position="right">
        <el-form-item label="站点名称">
          <el-input v-model="systemForm.siteName" style="width: 300px" />
        </el-form-item>
        <el-form-item label="开放注册">
          <el-switch v-model="systemForm.registerEnabled" />
        </el-form-item>
        <el-form-item label="默认注册角色">
          <el-select v-model="systemForm.defaultRole" style="width: 150px">
            <el-option label="学生" value="STUDENT" />
            <el-option label="管理员" value="ADMIN" />
          </el-select>
        </el-form-item>

        <el-form-item>
          <el-button type="primary" :loading="savingSystem" @click="handleSaveSystemConfig">
            保存系统配置
          </el-button>
        </el-form-item>
      </el-form>
    </el-card>

    <!-- AI 能力场景说明 -->
    <el-card class="config-card">
      <template #header>
        <div class="card-header">
          <span><el-icon><MagicStick /></el-icon> AI 能力场景</span>
        </div>
      </template>

      <el-row :gutter="20">
        <el-col :span="8" v-for="scenario in scenarios" :key="scenario.code">
          <div class="scenario-card" :class="{ disabled: !scenario.enabled }">
            <div class="scenario-icon">
              <el-icon :size="28">
                <component :is="scenario.icon" />
              </el-icon>
            </div>
            <div class="scenario-info">
              <div class="scenario-name">
                {{ scenario.name }}
                <el-tag v-if="!scenario.enabled" type="info" size="small" style="margin-left: 8px">
                  规划中
                </el-tag>
              </div>
              <div class="scenario-desc">{{ scenario.description }}</div>
            </div>
          </div>
        </el-col>
      </el-row>
    </el-card>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, computed, onMounted } from 'vue'
import { ElMessage } from 'element-plus'
import {
  Setting,
  Cpu,
  Tools,
  MagicStick,
  User,
  UserFilled,
  Avatar,
  CircleClose,
  Lightning,
  DataAnalysis,
  TrendCharts,
} from '@element-plus/icons-vue'
import {
  getAiOverview,
  testDeepSeekConnection,
  batchUpdateConfigs,
  getAiScenarios,
  type AiOverview,
  type AiScenario,
} from '@/api/system'

// 状态
const loading = ref(false)
const saving = ref(false)
const savingSystem = ref(false)
const testingConnection = ref(false)

// AI 概览
const aiOverview = ref<AiOverview>({
  provider: 'DEEPSEEK',
  deepseekConfigured: false,
  difyAnalyzeConfigured: false,
  difyGenerateConfigured: false,
  mockEnabled: true,
  defaultModel: 'deepseek-chat',
})

// AI 表单
const aiForm = reactive({
  provider: 'DEEPSEEK',
  deepseekBaseUrl: 'https://api.deepseek.com',
  deepseekApiKey: '',
  deepseekModel: 'deepseek-chat',
  difyBaseUrl: 'https://api.dify.ai/v1',
  difyAnalyzeKey: '',
  difyGenerateKey: '',
  mockEnabled: true,
})

// 系统表单
const systemForm = reactive({
  siteName: 'GramEval 英语语法考试系统',
  registerEnabled: true,
  defaultRole: 'STUDENT',
})

// 场景列表
const scenarios = ref<AiScenario[]>([])

// 计算属性
const providerLabel = computed(() => {
  const map: Record<string, string> = {
    DEEPSEEK: 'DeepSeek 直连',
    DIFY: 'Dify 工作流',
    HYBRID: '混合模式',
  }
  return map[aiOverview.value.provider] || aiOverview.value.provider
})

const providerTagType = computed(() => {
  const map: Record<string, string> = {
    DEEPSEEK: 'primary',
    DIFY: 'success',
    HYBRID: 'warning',
  }
  return (map[aiOverview.value.provider] as any) || 'info'
})

const enabledScenarios = computed(() => {
  return scenarios.value.filter((s) => s.enabled).length
})

// 方法
const loadAiOverview = async () => {
  loading.value = true
  try {
    const res = await getAiOverview()
    if (res.code === 200) {
      aiOverview.value = res.data
      aiForm.provider = res.data.provider || 'DEEPSEEK'
      aiForm.mockEnabled = res.data.mockEnabled
      aiForm.deepseekModel = res.data.defaultModel || 'deepseek-chat'
    }
  } catch (e) {
    console.error('加载 AI 概览失败', e)
  } finally {
    loading.value = false
  }
}

const loadScenarios = async () => {
  try {
    const res = await getAiScenarios()
    scenarios.value = res.data
  } catch (e) {
    console.error('加载场景列表失败', e)
  }
}

const handleTestDeepSeek = async () => {
  testingConnection.value = true
  try {
    const key = aiForm.deepseekApiKey && !aiForm.deepseekApiKey.includes('***')
      ? aiForm.deepseekApiKey
      : undefined
    const res = await testDeepSeekConnection(key)
    if (res.data.success) {
      ElMessage.success(res.data.message)
    } else {
      ElMessage.error(res.data.message)
    }
  } catch (e: any) {
    ElMessage.error('连接测试失败：' + (e.message || '未知错误'))
  } finally {
    testingConnection.value = false
  }
}

const handleSaveAiConfig = async () => {
  saving.value = true
  try {
    const configs: Record<string, string> = {
      'ai.provider': aiForm.provider,
      'ai.deepseek.base_url': aiForm.deepseekBaseUrl,
      'ai.deepseek.model': aiForm.deepseekModel,
      'ai.dify.base_url': aiForm.difyBaseUrl,
      'ai.mock_enabled': String(aiForm.mockEnabled),
    }

    // 只有输入了新的 Key 才更新（不含 ***）
    if (aiForm.deepseekApiKey && !aiForm.deepseekApiKey.includes('***')) {
      configs['ai.deepseek.api_key'] = aiForm.deepseekApiKey
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
    }
  } catch (e) {
    ElMessage.error('保存失败')
  } finally {
    saving.value = false
  }
}

const handleSaveSystemConfig = async () => {
  savingSystem.value = true
  try {
    const configs: Record<string, string> = {
      'system.site_name': systemForm.siteName,
      'system.register_enabled': String(systemForm.registerEnabled),
      'system.default_role': systemForm.defaultRole,
    }
    const res = await batchUpdateConfigs(configs)
    if (res.code === 200) {
      ElMessage.success('系统配置已保存')
    }
  } catch (e) {
    ElMessage.error('保存失败')
  } finally {
    savingSystem.value = false
  }
}

onMounted(() => {
  loadAiOverview()
  loadScenarios()
})
</script>

<style scoped>
.system-settings {
  padding: 20px;
  max-width: 1000px;
}

.overview-card {
  margin-bottom: 20px;
}

.config-card {
  margin-bottom: 20px;
}

.card-header {
  display: flex;
  align-items: center;
  gap: 8px;
  font-weight: 600;
  font-size: 16px;
}

.ai-overview {
  margin-bottom: 10px;
}

.form-tip {
  color: #909399;
  font-size: 12px;
  line-height: 1.6;
  margin-top: 4px;
}

.config-section h4 {
  margin: 0 0 15px 0;
  font-size: 14px;
  font-weight: 600;
  color: #303133;
}

.scenario-card {
  display: flex;
  align-items: flex-start;
  gap: 12px;
  padding: 16px;
  border: 1px solid #ebeef5;
  border-radius: 8px;
  margin-bottom: 16px;
  background: #fafafa;
  transition: all 0.2s;
}

.scenario-card:hover {
  border-color: #409eff;
  background: #ecf5ff;
}

.scenario-card.disabled {
  opacity: 0.5;
}

.scenario-icon {
  color: #409eff;
  margin-top: 2px;
}

.scenario-name {
  font-weight: 600;
  font-size: 14px;
  color: #303133;
  margin-bottom: 4px;
}

.scenario-desc {
  font-size: 12px;
  color: #606266;
  line-height: 1.5;
}
</style>
