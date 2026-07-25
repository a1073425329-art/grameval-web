<script setup lang="ts">import { ref, computed, onMounted } from 'vue';
import { ElMessage, ElMessageBox } from 'element-plus';
import { Plus, Edit, Delete, Document, Star, CollectionTag, View, Search, Filter } from '@element-plus/icons-vue';
import { listMyNotes, createStudyNote, updateStudyNote, deleteStudyNote, listCategories } from '@/api/student';
import type { StudyNote, StudyNoteQuery } from '@/api/student';
import type { Category } from '@/types/category';
const loading = ref(false);
const notes = ref<StudyNote[]>([]);
const total = ref(0);
const categories = ref<Category[]>([]);
// 查询条件
const queryForm = ref<StudyNoteQuery>({
 pageNum: 1,
 pageSize: 10,
});
const keyword = ref('');
const selectedType = ref('');
const selectedCategory = ref<number | undefined>();
// 笔记类型选项
const noteTypeOptions = [
 { label: '全部', value: '' },
 { label: '题目笔记', value: 'QUESTION' },
 { label: '知识点笔记', value: 'KNOWLEDGE' },
 { label: '复习笔记', value: 'REVIEW' },
 { label: '其他', value: 'OTHER' },
];
// 当前编辑的笔记
const editingNote = ref<StudyNote | null>(null);
const isEditing = ref(false);
const isAdding = ref(false);
// Element Plus 的 el-dialog 在 Vue 3 里必须用 v-model, 不能用 :visible.sync
// 用 computed 把两个开关合并成一个 boolean, 关闭时同步复位
const dialogVisible = computed<boolean>({
 get: () => isAdding.value || isEditing.value,
 set: (val) => {
   if (!val) {
     isAdding.value = false;
     isEditing.value = false;
     editingNote.value = null;
   }
 },
});
// 表单数据
const form = ref({
 title: '',
 content: '',
 noteType: 'OTHER' as 'QUESTION' | 'KNOWLEDGE' | 'REVIEW' | 'OTHER',
 tags: '',
 isPublic: false,
 categoryId: undefined as number | undefined,
 questionId: undefined as number | undefined,
});
const loadNotes = async () => {
 loading.value = true;
 try {
 const params: StudyNoteQuery = {
 pageNum: queryForm.value.pageNum,
 pageSize: queryForm.value.pageSize,
 noteType: selectedType.value || undefined,
 categoryId: selectedCategory.value,
 keyword: keyword.value || undefined,
 };
 const res = await listMyNotes(params);
 if (res.data) {
 notes.value = res.data.records || [];
 total.value = res.data.total || 0;
 }
 } catch (error) {
 ElMessage.error('加载笔记失败');
 } finally {
 loading.value = false;
 }
};
const loadCategories = async () => {
 try {
 const res = await listCategories();
 if (res.data) {
 categories.value = res.data;
 }
 } catch {
 // 忽略错误
 }
};
onMounted(() => {
 loadNotes();
 loadCategories();
});
const handleSearch = () => {
 queryForm.value.pageNum = 1;
 loadNotes();
};
const handleReset = () => {
 keyword.value = '';
 selectedType.value = '';
 selectedCategory.value = undefined;
 queryForm.value.pageNum = 1;
 loadNotes();
};
const handlePageChange = (page: number) => {
 queryForm.value.pageNum = page;
 loadNotes();
};
const openAddModal = () => {
 isAdding.value = true;
 isEditing.value = false;
 editingNote.value = null;
 form.value = {
 title: '',
 content: '',
 noteType: 'OTHER',
 tags: '',
 isPublic: false,
 categoryId: undefined,
 questionId: undefined,
 };
};
const openEditModal = (note: StudyNote) => {
 editingNote.value = note;
 isEditing.value = true;
 isAdding.value = false;
 form.value = {
 title: note.title,
 content: note.content,
 noteType: note.noteType,
 tags: note.tags,
 isPublic: note.isPublic,
 categoryId: note.categoryId,
 questionId: note.questionId,
 };
};
const handleSave = async () => {
 if (!form.value.title.trim()) {
 ElMessage.warning('请输入笔记标题');
 return;
 }
 if (!form.value.content.trim()) {
 ElMessage.warning('请输入笔记内容');
 return;
 }
 try {
 if (isEditing.value && editingNote.value) {
 await updateStudyNote(editingNote.value.id, form.value);
 ElMessage.success('更新成功');
 }
 else {
 await createStudyNote(form.value);
 ElMessage.success('创建成功');
 }
 closeModal();
 loadNotes();
 }
 catch {
 ElMessage.error('保存失败');
 }
};
const closeModal = () => {
 isAdding.value = false;
 isEditing.value = false;
 editingNote.value = null;
};
const handleDelete = async (note: StudyNote) => {
 try {
 await ElMessageBox.confirm(`确定删除笔记「${note.title}」？`, '确认删除', {
 type: 'warning',
 });
 await deleteStudyNote(note.id);
 ElMessage.success('删除成功');
 loadNotes();
 }
 catch {
 // 用户取消
 }
};
const getNoteTypeLabel = (type: string) => {
 const option = noteTypeOptions.find(o => o.value === type);
 return option?.label || type;
};
const getCategoryName = (categoryId?: number) => {
 if (!categoryId)
 return '';
 const cat = categories.value.find(c => c.id === categoryId);
 return cat?.categoryName || '';
};
const getTagsArray = (tags: string) => {
 return tags ? tags.split(',').filter(t => t.trim()) : [];
};

// 便于单元测试断言内部状态 (对生产运行时无副作用)
defineExpose({ dialogVisible, isAdding, isEditing, editingNote, form, openAddModal, openEditModal, handleSave, closeModal });
</script>

<template>
  <div class="study-notes-page">
    <!-- 页面头部 -->
    <div class="page-header">
      <h2>📚 学习笔记</h2>
      <p class="page-desc">记录学习过程中的知识点和心得</p>
      <el-button type="primary" icon="Plus" @click="openAddModal">
        新建笔记
      </el-button>
    </div>

    <!-- 查询区域 -->
    <el-card shadow="never" class="search-card">
      <el-row :gutter="16">
        <el-col :span="6">
          <el-input
            v-model="keyword"
            placeholder="搜索笔记标题"
            prefix-icon="Search"
            clearable
            @keyup.enter="handleSearch"
          />
        </el-col>
        <el-col :span="6">
          <el-select
            v-model="selectedType"
            placeholder="笔记类型"
            clearable
            style="width: 100%"
          >
            <el-option
              v-for="opt in noteTypeOptions"
              :key="opt.value"
              :label="opt.label"
              :value="opt.value"
            />
          </el-select>
        </el-col>
        <el-col :span="6">
          <el-select
            v-model="selectedCategory"
            placeholder="关联分类"
            clearable
            style="width: 100%"
          >
            <el-option
              v-for="cat in categories"
              :key="cat.id"
              :label="cat.categoryName"
              :value="cat.id"
            />
          </el-select>
        </el-col>
        <el-col :span="6">
          <el-button type="primary" @click="handleSearch">查询</el-button>
          <el-button @click="handleReset">重置</el-button>
        </el-col>
      </el-row>
    </el-card>

    <!-- 笔记列表 -->
    <div class="notes-list" v-loading="loading">
      <div v-if="notes.length" class="notes-grid">
        <div
          v-for="note in notes"
          :key="note.id"
          class="note-card"
          @click="openEditModal(note)"
        >
          <div class="note-header">
            <div class="note-title-row">
              <h3 class="note-title">{{ note.title }}</h3>
              <el-tag size="small" :type="note.noteType === 'KNOWLEDGE' ? 'primary' : note.noteType === 'QUESTION' ? 'success' : 'info'">
                {{ getNoteTypeLabel(note.noteType) }}
              </el-tag>
            </div>
            <div class="note-meta">
              <span v-if="getCategoryName(note.categoryId)" class="meta-item">
                <el-icon><Document /></el-icon>
                {{ getCategoryName(note.categoryId) }}
              </span>
              <span class="meta-item">
                <el-icon><View /></el-icon>
                {{ note.viewsCount }}
              </span>
              <span class="meta-item">
                {{ note.createTime?.slice(0, 10) }}
              </span>
              <el-tag v-if="note.isPublic" size="small" type="warning">公开</el-tag>
            </div>
          </div>
          <div class="note-content">
            {{ note.content.length > 100 ? note.content.slice(0, 100) + '...' : note.content }}
          </div>
          <div v-if="getTagsArray(note.tags).length" class="note-tags">
            <el-tag
              v-for="tag in getTagsArray(note.tags)"
              :key="tag"
              size="small"
              class="tag-item"
            >
              <el-icon><CollectionTag /></el-icon>{{ tag }}
            </el-tag>
          </div>
          <div class="note-actions">
            <el-button size="small" icon="Edit" @click.stop="openEditModal(note)">编辑</el-button>
            <el-button size="small" icon="Delete" type="danger" @click.stop="handleDelete(note)">删除</el-button>
          </div>
        </div>
      </div>
      <el-empty v-else description="暂无笔记，点击右上角创建" :image-size="100" />
    </div>

    <!-- 分页 -->
    <div class="pagination-wrap" v-if="total > 0">
      <el-pagination
        v-model:current-page="queryForm.pageNum"
        v-model:page-size="queryForm.pageSize"
        :total="total"
        :page-sizes="[10, 20, 50]"
        layout="total, sizes, prev, pager, next, jumper"
        @size-change="loadNotes"
        @current-change="handlePageChange"
      />
    </div>

    <!-- 编辑/新建弹窗 -->
    <el-dialog
      :title="isAdding ? '新建笔记' : '编辑笔记'"
      v-model="dialogVisible"
      width="600px"
      destroy-on-close
    >
      <el-form :model="form" label-width="100px">
        <el-form-item label="笔记标题" required>
          <el-input v-model="form.title" placeholder="请输入笔记标题" />
        </el-form-item>
        <el-form-item label="笔记类型">
          <el-select v-model="form.noteType" style="width: 100%">
            <el-option
              v-for="opt in noteTypeOptions.filter(o => o.value)"
              :key="opt.value"
              :label="opt.label"
              :value="opt.value"
            />
          </el-select>
        </el-form-item>
        <el-form-item label="关联分类">
          <el-select v-model="form.categoryId" placeholder="可选" clearable style="width: 100%">
            <el-option
              v-for="cat in categories"
              :key="cat.id"
              :label="cat.categoryName"
              :value="cat.id"
            />
          </el-select>
        </el-form-item>
        <el-form-item label="标签">
          <el-input v-model="form.tags" placeholder="多个标签用逗号分隔" />
        </el-form-item>
        <el-form-item label="笔记内容" required>
          <el-input
            v-model="form.content"
            type="textarea"
            :rows="8"
            placeholder="请输入笔记内容..."
          />
        </el-form-item>
        <el-form-item label="公开分享">
          <el-switch v-model="form.isPublic" />
          <span class="switch-tip">公开后其他学生可查看</span>
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="closeModal">取消</el-button>
        <el-button type="primary" @click="handleSave">保存</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<style scoped lang="scss">
.study-notes-page { padding: 4px; }

.page-header {
  display: flex; justify-content: space-between; align-items: center;
  margin-bottom: 16px;
  h2 { margin: 0; font-size: 20px; font-weight: 600; }
  .page-desc { margin: 4px 0 0; color: #909399; font-size: 13px; }
}

.search-card { margin-bottom: 16px; }

.notes-list { margin-bottom: 16px; }

.notes-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(380px, 1fr));
  gap: 16px;
}

.note-card {
  background: #fff;
  border-radius: 8px;
  padding: 20px;
  box-shadow: 0 1px 3px rgba(0,0,0,0.06);
  cursor: pointer;
  transition: transform 0.15s, box-shadow 0.15s;
  &:hover {
    transform: translateY(-2px);
    box-shadow: 0 4px 12px rgba(0,0,0,0.1);
  }
}

.note-header { margin-bottom: 12px; }

.note-title-row {
  display: flex; justify-content: space-between; align-items: flex-start;
  margin-bottom: 8px;
}

.note-title {
  font-size: 16px; font-weight: 600; color: #303133;
  margin: 0; flex: 1; margin-right: 12px;
  overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
}

.note-meta {
  display: flex; align-items: center; gap: 16px;
  font-size: 12px; color: #909399;
  .meta-item { display: flex; align-items: center; gap: 4px; }
}

.note-content {
  font-size: 14px; color: #606266; line-height: 1.6;
  margin-bottom: 12px;
  overflow: hidden;
  display: -webkit-box;
  -webkit-line-clamp: 3;
  -webkit-box-orient: vertical;
}

.note-tags {
  display: flex; flex-wrap: wrap; gap: 6px;
  margin-bottom: 12px;
  .tag-item { background: #ecf5ff; color: #409eff; }
}

.note-actions {
  display: flex; justify-content: flex-end; gap: 8px;
  padding-top: 12px;
  border-top: 1px solid #f5f7fa;
}

.pagination-wrap {
  display: flex; justify-content: center;
  padding: 16px 0;
}

.switch-tip { margin-left: 8px; font-size: 12px; color: #909399; }
</style>
