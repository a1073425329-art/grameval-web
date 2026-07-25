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

      <el-descriptions :column="4" border size="default">
        <el-descriptions-item label="AI 智能体">
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
          <el-form :model="aiForm" label-width="150px" label-position="right">
            <el-form-item label="智能体提供商">
              <el-radio-group v-model="aiForm.provider">
                <el-radio value="DEEPSEEK">DeepSeek 直连</el-radio>
                <el-radio value="DIFY">Dify 工作流</el-radio>
                <el-radio value="HYBRID">混合模式</el-radio>
              </el-radio-group>
              <div class="form-tip">
                DeepSeek 直连：直接调用 DeepSeek API，响应快，适合分析类场景
                <br />Dify 工作流：通过 Dify 编排复杂流程，适合智能出题等多步骤场景
                <br />混合模式：分析用 DeepSeek，出题用 Dify
              </div>
            </el-form-item>

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
                :loading="testingConnection"
                style="margin-left: 10px"
                @click="handleTestDeepSeek"
              >
                测试连接
              </el-button>
            </el-form-item>
            <el-form-item label="默认模型">
              <el-select v-model="aiForm.deepseekModel" style="width: 250px">
                <el-option label="deepseek-v4-pro（最新旗舰）" value="deepseek-v4-pro" />
                <el-option label="deepseek-v4-flash（高速轻量）" value="deepseek-v4-flash" />
                <el-option label="deepseek-chat（标准）" value="deepseek-chat" />
                <el-option label="deepseek-r1.5b（推理模型）" value="deepseek-r1.5b" />
              </el-select>
              <div class="form-tip">推荐使用 deepseek-v4-pro，性能最强</div>
            </el-form-item>
            <el-form-item label="请求超时">
              <el-input-number v-model="aiForm.timeout" :min="5" :max="120" style="width: 150px" />
              <span class="form-tip">秒</span>
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

            <el-divider content-position="left">其他设置</el-divider>

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
import { ref, reactive, computed, onMounted } from 'vue'
import { ElMessage } from 'element-plus'
import {
  Setting,
  Tools,
  Refresh,
} from '@element-plus/icons-vue'
import {
  getAiOverview,
  testDeepSeekConnection,
  batchUpdateConfigs,
  refreshConfigs,
  type AiOverview,
} from '@/api/system'

// 状态
const loading = ref(false)
const saving = ref(false)
const testingConnection = ref(false)
const activeTab = ref('ai')

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
  timeout: 30,
  difyBaseUrl: 'https://api.dify.ai/v1',
  difyAnalyzeKey: '',
  difyGenerateKey: '',
  mockEnabled: true,
})

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

const handleRefresh = async () => {
  try {
    const res = await refreshConfigs()
    if (res.code === 200) {
      ElMessage.success('配置缓存已刷新')
      await loadAiOverview()
    }
  } catch (e) {
    ElMessage.error('刷新失败')
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
      'ai.dify.base_url': aiForm.difyBaseUrl,
      'ai.mock_enabled': String(aiForm.mockEnabled),
    }

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

onMounted(() => {
  loadAiOverview()
})
</script>

<style scoped>
.system-settings {
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

.el-tabs {
  margin-top: 10px;
}

.el-form-item {
  margin-bottom: 20px;
}

.el-divider {
  margin: 24px 0;
}
</style>
