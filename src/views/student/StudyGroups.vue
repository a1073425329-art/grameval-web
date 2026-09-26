<script setup lang="ts">import { ref, onMounted } from 'vue';
import { ElMessage, ElMessageBox } from 'element-plus';
import { Plus, User, ArrowRight, ArrowLeft } from '@element-plus/icons-vue';
import { listMyGroups, createStudyGroup, joinGroup, leaveGroup, searchGroups, listGroupMembers } from '@/api/student';
import type { StudyGroup, GroupMember } from '@/api/student';
const loading = ref(false);
const myGroups = ref<StudyGroup[]>([]);
const searchResult = ref<StudyGroup[]>([]);
const searchKeyword = ref('');
const isSearching = ref(false);
// 创建小组弹窗
const showCreateModal = ref(false);
const createForm = ref({
 groupName: '',
 description: '',
 maxMembers: 20,
});
// 小组详情弹窗
const showDetailModal = ref(false);
const currentGroup = ref<StudyGroup | null>(null);
const groupMembers = ref<GroupMember[]>([]);
const loadMyGroups = async () => {
 loading.value = true;
 try {
 const res = await listMyGroups();
 if (res.data) {
 myGroups.value = res.data;
 }
 }
 catch {
 ElMessage.error('加载小组失败');
 }
 finally {
 loading.value = false;
 }
};
onMounted(loadMyGroups);
const handleSearch = async () => {
 if (!searchKeyword.value.trim()) {
 searchResult.value = [];
 isSearching.value = false;
 return;
 }
 isSearching.value = true;
 try {
 const res = await searchGroups(searchKeyword.value);
 if (res.data) {
 searchResult.value = res.data;
 }
 }
 catch {
 ElMessage.error('搜索失败');
 }
};
const handleCreate = async () => {
 if (!createForm.value.groupName.trim()) {
 ElMessage.warning('请输入小组名称');
 return;
 }
 try {
 await createStudyGroup(createForm.value);
 ElMessage.success('创建成功');
 showCreateModal.value = false;
 createForm.value = { groupName: '', description: '', maxMembers: 20 };
 loadMyGroups();
 }
 catch {
 ElMessage.error('创建失败');
 }
};
const handleJoin = async (groupId: number) => {
 try {
 await joinGroup(groupId);
 ElMessage.success('加入成功');
 loadMyGroups();
 searchResult.value = searchResult.value.filter(g => g.id !== groupId);
 }
 catch {
 ElMessage.error('加入失败');
 }
};
const handleLeave = async (groupId: number) => {
 try {
 await ElMessageBox.confirm('确定退出该小组？', '确认退出', { type: 'warning' });
 await leaveGroup(groupId);
 ElMessage.success('退出成功');
 loadMyGroups();
 if (currentGroup.value?.id === groupId) {
 showDetailModal.value = false;
 currentGroup.value = null;
 }
 }
 catch {
 // 用户取消
 }
};
const openDetail = async (group: StudyGroup) => {
 currentGroup.value = group;
 try {
 const res = await listGroupMembers(group.id);
 if (res.data) {
 groupMembers.value = res.data;
 }
 }
 catch {
 groupMembers.value = [];
 }
 showDetailModal.value = true;
};
const isMember = (groupId: number) => {
 return myGroups.value.some(g => g.id === groupId);
};
const getRoleLabel = (role: string) => {
 const roles: Record<string, string> = {
 OWNER: '创建者',
 ADMIN: '管理员',
 MEMBER: '成员',
 };
 return roles[role] || role;
};

// 便于单元测试断言(生产运行时无副作用)
defineExpose({ showCreateModal, showDetailModal, myGroups, searchResult, createForm, handleCreate });
</script>

<template>
  <div class="study-groups-page">
    <!-- 页面头部 -->
    <div class="page-header">
      <div>
        <h2>👥 学习小组</h2>
        <p class="page-desc">与同学一起学习，互相监督，共同进步</p>
      </div>
      <el-button type="primary" @click="showCreateModal = true">
        <el-icon><Plus /></el-icon>创建小组
      </el-button>
    </div>

    <!-- 搜索小组 -->
    <el-card shadow="never" class="search-card">
      <el-row :gutter="16">
        <el-col :span="12">
          <el-input
            v-model="searchKeyword"
            placeholder="搜索小组名称"
            prefix-icon="Search"
            clearable
            @keyup.enter="handleSearch"
          />
        </el-col>
        <el-col :span="4">
          <el-button type="primary" @click="handleSearch">搜索</el-button>
        </el-col>
      </el-row>
    </el-card>

    <!-- 搜索结果 -->
    <div v-if="isSearching && searchResult.length" class="section">
      <h3 class="section-title">🔍 搜索结果</h3>
      <div class="groups-grid">
        <div
          v-for="group in searchResult"
          :key="group.id"
          class="group-card"
        >
          <div class="group-header">
            <div class="group-avatar">👥</div>
            <div class="group-info">
              <div class="group-name">{{ group.groupName }}</div>
              <div class="group-meta">{{ group.memberCount }}/{{ group.maxMembers }} 成员</div>
            </div>
          </div>
          <div class="group-desc">{{ group.description || '暂无描述' }}</div>
          <div class="group-footer">
            <span class="create-time">创建于 {{ group.createTime?.slice(0, 10) }}</span>
            <el-button
              v-if="!isMember(group.id)"
              type="primary"
              size="small"
              @click="handleJoin(group.id)"
            >
              <el-icon><ArrowRight /></el-icon>加入
            </el-button>
            <el-tag v-else type="success" size="small">已加入</el-tag>
          </div>
        </div>
      </div>
    </div>

    <!-- 我的小组 -->
    <div class="section">
      <h3 class="section-title">🏠 我的小组（{{ myGroups.length }}）</h3>
      <div v-if="myGroups.length" class="groups-grid">
        <div
          v-for="group in myGroups"
          :key="group.id"
          class="group-card owned"
        >
          <div class="group-header">
            <div class="group-avatar">👥</div>
            <div class="group-info">
              <div class="group-name">{{ group.groupName }}</div>
              <div class="group-meta">{{ group.memberCount }}/{{ group.maxMembers }} 成员</div>
            </div>
            <el-tag v-if="group.status === 'ACTIVE'" type="success" size="small">活跃</el-tag>
          </div>
          <div class="group-desc">{{ group.description || '暂无描述' }}</div>
          <div class="group-footer">
            <span class="create-time">创建于 {{ group.createTime?.slice(0, 10) }}</span>
            <div class="group-actions">
              <el-button size="small" @click="openDetail(group)">
                <el-icon><User /></el-icon>成员
              </el-button>
              <el-button size="small" type="danger" @click="handleLeave(group.id)">
                <el-icon><ArrowLeft /></el-icon>退出
              </el-button>
            </div>
          </div>
        </div>
      </div>
      <el-empty v-else description="还没有加入任何小组，搜索并加入一个吧！" :image-size="80" />
    </div>

    <!-- 创建小组弹窗 -->
    <el-dialog title="创建学习小组" v-model="showCreateModal" width="400px">
      <el-form :model="createForm" label-width="80px">
        <el-form-item label="小组名称" required>
          <el-input v-model="createForm.groupName" placeholder="请输入小组名称" />
        </el-form-item>
        <el-form-item label="小组描述">
          <el-input v-model="createForm.description" type="textarea" :rows="3" placeholder="请输入小组描述" />
        </el-form-item>
        <el-form-item label="最大成员数">
          <el-input-number v-model="createForm.maxMembers" :min="2" :max="100" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="showCreateModal = false">取消</el-button>
        <el-button type="primary" @click="handleCreate">创建</el-button>
      </template>
    </el-dialog>

    <!-- 小组详情弹窗 -->
    <el-dialog
      :title="currentGroup?.groupName"
      v-model="showDetailModal"
      width="600px"
    >
      <div v-if="currentGroup" class="group-detail">
        <div class="detail-header">
          <div class="detail-avatar">👥</div>
          <div class="detail-info">
            <div class="detail-name">{{ currentGroup.groupName }}</div>
            <div class="detail-desc">{{ currentGroup.description || '暂无描述' }}</div>
          </div>
        </div>
        <div class="detail-stats">
          <span>成员数：{{ currentGroup.memberCount }}/{{ currentGroup.maxMembers }}</span>
          <span>创建时间：{{ currentGroup.createTime?.slice(0, 10) }}</span>
        </div>
        <h4 class="members-title">成员列表</h4>
        <el-table :data="groupMembers" size="small">
          <el-table-column label="头像" width="60">
            <template #default="{ row }">
              <div class="member-avatar">{{ row.avatar ? '👤' : '👥' }}</div>
            </template>
          </el-table-column>
          <el-table-column prop="realName" label="姓名" />
          <el-table-column prop="username" label="用户名" />
          <el-table-column label="角色" width="100">
            <template #default="{ row }">
              <el-tag :type="row.role === 'OWNER' ? 'danger' : row.role === 'ADMIN' ? 'warning' : 'info'" size="small">
                {{ getRoleLabel(row.role) }}
              </el-tag>
            </template>
          </el-table-column>
          <el-table-column label="加入时间" width="160">
            <template #default="{ row }">{{ row.joinTime?.slice(0, 16) }}</template>
          </el-table-column>
        </el-table>
      </div>
      <template #footer>
        <el-button @click="showDetailModal = false">关闭</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<style scoped lang="scss">
.study-groups-page { padding: 4px; }

.page-header {
  display: flex; justify-content: space-between; align-items: center;
  margin-bottom: 16px;
  h2 { margin: 0; font-size: 20px; font-weight: 600; }
  .page-desc { margin: 4px 0 0; color: #909399; font-size: 13px; }
}

.search-card { margin-bottom: 16px; }

.section { margin-bottom: 24px; }

.section-title {
  font-size: 16px; font-weight: 600; color: #303133;
  margin-bottom: 12px;
}

.groups-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
  gap: 16px;
}

.group-card {
  background: #fff;
  border-radius: 8px;
  padding: 16px;
  box-shadow: 0 1px 3px rgba(0,0,0,0.06);
  transition: transform 0.15s, box-shadow 0.15s;
  &:hover {
    transform: translateY(-2px);
    box-shadow: 0 4px 12px rgba(0,0,0,0.1);
  }
  &.owned {
    border: 1px solid rgba(64, 158, 255, 0.3);
    background: linear-gradient(180deg, #f0f5ff 0%, #fff 100%);
  }
}

.group-header {
  display: flex; align-items: center; gap: 12px;
  margin-bottom: 12px;
}

.group-avatar {
  width: 48px; height: 48px;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  border-radius: 12px;
  display: flex; align-items: center; justify-content: center;
  font-size: 24px;
}

.group-info { flex: 1; }

.group-name {
  font-size: 16px; font-weight: 600; color: #303133;
  margin-bottom: 4px;
}

.group-meta { font-size: 12px; color: #909399; }

.group-desc {
  font-size: 14px; color: #606266;
  line-height: 1.5;
  margin-bottom: 12px;
}

.group-footer {
  display: flex; justify-content: space-between; align-items: center;
  padding-top: 12px;
  border-top: 1px solid #f5f7fa;
}

.create-time { font-size: 12px; color: #909399; }

.group-actions { display: flex; gap: 8px; }

.group-detail { padding: 8px 0; }

.detail-header {
  display: flex; gap: 16px;
  padding: 16px;
  background: #fafafa;
  border-radius: 8px;
  margin-bottom: 16px;
}

.detail-avatar {
  width: 64px; height: 64px;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  border-radius: 16px;
  display: flex; align-items: center; justify-content: center;
  font-size: 32px;
}

.detail-info { flex: 1; }

.detail-name { font-size: 18px; font-weight: 600; color: #303133; margin-bottom: 4px; }

.detail-desc { font-size: 14px; color: #606266; }

.detail-stats {
  display: flex; gap: 24px;
  font-size: 13px; color: #909399;
  margin-bottom: 16px;
}

.members-title {
  font-size: 14px; font-weight: 600; color: #303133;
  margin-bottom: 12px;
}

.member-avatar {
  width: 36px; height: 36px;
  background: #e4e7ed;
  border-radius: 50%;
  display: flex; align-items: center; justify-content: center;
  font-size: 16px;
}
</style>
