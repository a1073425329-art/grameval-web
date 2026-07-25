<script setup lang="ts">import { ref, onMounted, nextTick } from 'vue';
import { ElMessage } from 'element-plus';
import { Message, Plus, More, Refresh, ArrowRight } from '@element-plus/icons-vue';
import { createChatSession, listChatSessions, listChatMessages, sendChatMessage, deleteChatSession } from '@/api/student';
import type { ChatSession, ChatMessage } from '@/api/student';
const loading = ref(false);
const sessions = ref<ChatSession[]>([]);
const currentSession = ref<ChatSession | null>(null);
const messages = ref<ChatMessage[]>([]);
const inputMessage = ref('');
const sending = ref(false);
const messagesContainer = ref<HTMLElement | null>(null);
const loadSessions = async () => {
 loading.value = true;
 try {
 const res = await listChatSessions();
 if (res.data) {
 sessions.value = res.data;
 if (sessions.value.length && !currentSession.value) {
 currentSession.value = sessions.value[0];
 await loadMessages(sessions.value[0].id);
 }
 }
 }
 catch {
 ElMessage.error('加载会话失败');
 }
 finally {
 loading.value = false;
 }
};
const loadMessages = async (sessionId: number) => {
 try {
 const res = await listChatMessages(sessionId);
 if (res.data) {
 messages.value = res.data;
 await nextTick();
 scrollToBottom();
 }
 }
 catch {
 ElMessage.error('加载消息失败');
 }
};
const createNewSession = async () => {
 try {
 const res = await createChatSession('新对话');
 if (res.data) {
 currentSession.value = res.data;
 sessions.value.unshift(res.data);
 messages.value = [];
 }
 }
 catch {
 ElMessage.error('创建会话失败');
 }
};
const selectSession = (session: ChatSession) => {
 currentSession.value = session;
 loadMessages(session.id);
};
const deleteSession = async (sessionId: number) => {
 try {
 await deleteChatSession(sessionId);
 sessions.value = sessions.value.filter(s => s.id !== sessionId);
 if (currentSession.value?.id === sessionId) {
 currentSession.value = sessions.value.length > 0 ? sessions.value[0] : null;
 messages.value = [];
 if (currentSession.value) {
 await loadMessages(currentSession.value.id);
 }
 }
 ElMessage.success('删除成功');
 }
 catch {
 ElMessage.error('删除失败');
 }
};
const handleSend = async () => {
 if (!inputMessage.value.trim() || !currentSession.value)
 return;
 const content = inputMessage.value.trim();
 inputMessage.value = '';
 // 添加用户消息
 const userMsg: ChatMessage = {
 id: Date.now(),
 userId: 0,
 role: 'USER',
 content,
 messageType: 'TEXT',
 createTime: new Date().toISOString(),
 };
 messages.value.push(userMsg);
 scrollToBottom();
 sending.value = true;
 try {
 const res = await sendChatMessage(currentSession.value.id, content);
 if (res.data) {
 messages.value.push(res.data);
 }
 }
 catch {
 ElMessage.error('发送失败，请稍后重试');
 }
 finally {
 sending.value = false;
 scrollToBottom();
 }
};
const scrollToBottom = () => {
 if (messagesContainer.value) {
 messagesContainer.value.scrollTop = messagesContainer.value.scrollHeight;
 }
};
onMounted(() => {
 loadSessions();
});
</script>

<template>
  <div class="ai-assistant-page">
    <div class="assistant-layout">
      <!-- 会话列表 -->
      <div class="sidebar">
        <div class="sidebar-header">
          <h3>🤖 AI学习助手</h3>
          <el-button size="small" type="primary" @click="createNewSession">
            <el-icon><Plus /></el-icon>新对话
          </el-button>
        </div>
        <div class="sessions-list" v-loading="loading">
          <div
            v-for="session in sessions"
            :key="session.id"
            :class="['session-item', currentSession?.id === session.id ? 'active' : '']"
            @click="selectSession(session)"
          >
            <div class="session-info" style="width:100%">
              <div class="session-title">{{ session.title }}</div>
              <div class="session-preview">
                {{ session.lastMessage || '暂无消息' }}
              </div>
            </div>
            <div class="session-actions">
              <el-button
                size="small"
                type="danger"
                link
                @click.stop="deleteSession(session.id)"
              >
                删除
              </el-button>
            </div>
          </div>
          <el-empty v-if="!sessions.length" description="暂无对话" :image-size="60" />
        </div>
      </div>

      <!-- 聊天区域 -->
      <div class="chat-area">
        <!-- 空状态 -->
        <div v-if="!currentSession" class="empty-chat">
          <el-icon size="64"><Message /></el-icon>
          <h3>开始与AI助手对话</h3>
          <p>点击左侧"新对话"按钮开始学习咨询</p>
          <el-button type="primary" @click="createNewSession">
            <el-icon><Plus /></el-icon>创建新对话
          </el-button>
        </div>

        <!-- 聊天内容 -->
        <div v-else class="chat-content">
          <!-- 聊天头部 -->
          <div class="chat-header">
            <div class="chat-title">{{ currentSession.title }}</div>
            <div class="chat-actions">
              <el-button size="small" @click="loadMessages(currentSession.id)">
                <el-icon><Refresh /></el-icon>刷新
              </el-button>
              <el-button size="small" @click="createNewSession">
                <el-icon><Plus /></el-icon>新对话
              </el-button>
            </div>
          </div>

          <!-- 消息列表 -->
          <div ref="messagesContainer" class="messages-list">
            <div
              v-for="msg in messages"
              :key="msg.id"
              :class="['message-item', msg.role === 'USER' ? 'user' : 'assistant']"
            >
              <div class="msg-avatar">
                {{ msg.role === 'USER' ? '👤' : '🤖' }}
              </div>
              <div class="msg-content">
                <div class="msg-text">{{ msg.content }}</div>
                <div class="msg-time">{{ msg.createTime?.slice(11, 16) }}</div>
              </div>
            </div>
            <div v-if="sending" class="typing-indicator">
              <div class="typing-dots">
                <span></span><span></span><span></span>
              </div>
              <span>AI正在思考...</span>
            </div>
          </div>

          <!-- 输入框 -->
          <div class="chat-input">
            <el-input
              v-model="inputMessage"
              placeholder="输入你的问题，AI助手会为你解答..."
              type="textarea"
              :rows="2"
              @keyup.enter="handleSend"
            />
            <el-button
              type="primary"
              :loading="sending"
              @click="handleSend"
              class="send-btn"
            >
              <el-icon><ArrowRight /></el-icon>发送
            </el-button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped lang="scss">
.ai-assistant-page {
  height: calc(100vh - 80px);
  display: flex;
}

.assistant-layout {
  flex: 1;
  display: flex;
  overflow: hidden;
}

.sidebar {
  width: 320px;
  background: #f5f7fa;
  border-right: 1px solid #e4e7ed;
  display: flex;
  flex-direction: column;
}

.sidebar-header {
  padding: 16px;
  border-bottom: 1px solid #e4e7ed;
  display: flex; justify-content: space-between; align-items: center;
  h3 { margin: 0; font-size: 16px; }
}

.sessions-list {
  flex: 1;
  overflow-y: auto;
  padding: 8px;
}

.session-item {
  padding: 12px;
  background: #fff;
  border-radius: 8px;
  margin-bottom: 8px;
  cursor: pointer;
  transition: all 0.15s;
  display: flex; justify-content: space-between; align-items: center;
  &:hover { background: #ecf5ff; }
  &.active { background: #409eff; }
  &.active .session-title, &.active .session-preview { color: #fff; }
}

.session-title {
  font-size: 14px; font-weight: 500; color: #303133;
  margin-bottom: 4px;
}

.session-preview {
  font-size: 12px; color: #909399;
  overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
}

.session-actions { opacity: 0; transition: opacity 0.15s; }

.session-item:hover .session-actions { opacity: 1; }

.chat-area {
  flex: 1;
  display: flex;
  flex-direction: column;
  background: #fff;
}

.empty-chat {
  flex: 1;
  display: flex; flex-direction: column;
  align-items: center; justify-content: center;
  color: #909399;
  h3 { margin: 16px 0 8px; font-size: 18px; color: #303133; }
  p { margin: 0 0 24px; font-size: 14px; }
}

.chat-content {
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.chat-header {
  padding: 16px 24px;
  border-bottom: 1px solid #e4e7ed;
  display: flex; justify-content: space-between; align-items: center;
  .chat-title { font-size: 16px; font-weight: 600; color: #303133; }
}

.messages-list {
  flex: 1;
  overflow-y: auto;
  padding: 16px 24px;
  background: #fafafa;
}

.message-item {
  display: flex; gap: 12px;
  margin-bottom: 16px;
  &.user { flex-direction: row-reverse; }
  &.user .msg-content { align-items: flex-end; }
}

.msg-avatar {
  width: 40px; height: 40px;
  border-radius: 50%;
  background: #e4e7ed;
  display: flex; align-items: center; justify-content: center;
  font-size: 20px;
  flex-shrink: 0;
}

.msg-content {
  max-width: 60%;
  display: flex; flex-direction: column;
}

.msg-text {
  padding: 12px 16px;
  border-radius: 12px;
  font-size: 14px;
  line-height: 1.6;
}

.user .msg-text {
  background: #409eff;
  color: #fff;
  border-radius: 12px 0 12px 12px;
}

.assistant .msg-text {
  background: #fff;
  color: #303133;
  border-radius: 0 12px 12px 12px;
  box-shadow: 0 1px 2px rgba(0,0,0,0.05);
}

.msg-time {
  font-size: 11px; color: #909399;
  margin-top: 4px;
}

.typing-indicator {
  display: flex; align-items: center; gap: 8px;
  padding: 8px 16px;
  background: #fff;
  border-radius: 12px;
  color: #909399;
  font-size: 13px;
  width: fit-content;
}

.typing-dots {
  display: flex; gap: 4px;
  span {
    width: 6px; height: 6px;
    background: #909399;
    border-radius: 50%;
    animation: typing 1.4s infinite ease-in-out both;
    &:nth-child(1) { animation-delay: -0.32s; }
    &:nth-child(2) { animation-delay: -0.16s; }
  }
}

@keyframes typing {
  0%, 80%, 100% { transform: scale(0); }
  40% { transform: scale(1); }
}

.chat-input {
  padding: 16px 24px;
  border-top: 1px solid #e4e7ed;
  display: flex; gap: 12px;
  background: #fff;
  .send-btn { align-self: flex-end; }
}
</style>
