import React, { useState, useEffect } from 'react';
import {
  Box,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TablePagination,
  Typography,
  IconButton,
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  Chip,
  Pagination,
  Alert,
  CircularProgress
} from '@mui/material';
import { Edit as EditIcon, Delete as DeleteIcon } from '@mui/icons-material';
import { User, UserUpdateData, userManagementApi } from '../../services/api';

interface EditDialogProps {
  open: boolean;
  user: User | null;
  onClose: () => void;
  onSave: (userId: number, data: UserUpdateData) => void;
}

const EditDialog: React.FC<EditDialogProps> = ({ open, user, onClose, onSave }) => {
  const [formData, setFormData] = useState<UserUpdateData>({
    name: '',
    organization: '',
    role: 'user',
    is_active: true,
  });

  useEffect(() => {
    if (user) {
      setFormData({
        name: user.name,
        organization: user.organization,
        role: user.role,
        is_active: user.is_active,
      });
    }
  }, [user]);

  const handleSubmit = () => {
    if (user) {
      onSave(user.id, formData);
    }
    onClose();
  };

  return (
    <Dialog open={open} onClose={onClose}>
      <DialogTitle>사용자 정보 수정</DialogTitle>
      <DialogContent>
        <TextField
          margin="dense"
          label="이름"
          fullWidth
          value={formData.name}
          onChange={(e) => setFormData({ ...formData, name: e.target.value })}
        />
        <TextField
          margin="dense"
          label="소속"
          fullWidth
          value={formData.organization}
          onChange={(e) => setFormData({ ...formData, organization: e.target.value })}
        />
        <FormControl fullWidth margin="dense">
          <InputLabel>역할</InputLabel>
          <Select
            value={formData.role}
            onChange={(e) => setFormData({ ...formData, role: e.target.value as 'admin' | 'user' })}
          >
            <MenuItem value="user">일반 사용자</MenuItem>
            <MenuItem value="admin">관리자</MenuItem>
          </Select>
        </FormControl>
        <FormControl fullWidth margin="dense">
          <InputLabel>상태</InputLabel>
          <Select
            value={formData.is_active}
            onChange={(e) => setFormData({ ...formData, is_active: e.target.value === 'true' })}
          >
            <MenuItem value="true">활성</MenuItem>
            <MenuItem value="false">비활성</MenuItem>
          </Select>
        </FormControl>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>취소</Button>
        <Button onClick={handleSubmit} color="primary">저장</Button>
      </DialogActions>
    </Dialog>
  );
};

const UserManagement: React.FC = () => {
  const [users, setUsers] = useState<User[]>([]);
  const [totalUsers, setTotalUsers] = useState(0);
  const [page, setPage] = useState(1);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const rowsPerPage = 10;

  const fetchUsers = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await userManagementApi.getUsers((page - 1) * rowsPerPage, rowsPerPage);
      setUsers(response.users);
      setTotalUsers(response.total);
    } catch (err: any) {
      console.error('Error fetching users:', err);
      setError(err.response?.data?.detail || '사용자 목록을 불러오는데 실패했습니다.');
      setUsers([]);
      setTotalUsers(0);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, [page]);

  const handleEditClick = (user: User) => {
    setSelectedUser(user);
    setEditDialogOpen(true);
  };

  const handleEditSave = async (userId: number, data: UserUpdateData) => {
    try {
      await userManagementApi.updateUser(userId, data);
      fetchUsers();
      setError(null);
    } catch (err: any) {
      setError(err.response?.data?.detail || '사용자 정보 수정에 실패했습니다.');
    }
  };

  const handleDeleteClick = async (userId: number) => {
    if (window.confirm('정말로 이 사용자를 삭제하시겠습니까?')) {
      try {
        await userManagementApi.deleteUser(userId);
        fetchUsers();
        setError(null);
      } catch (err: any) {
        setError(err.response?.data?.detail || '사용자 삭제에 실패했습니다.');
      }
    }
  };

  const handlePageChange = (event: React.ChangeEvent<unknown>, value: number) => {
    setPage(value);
  };

  return (
    <Box sx={{ padding: 3 }}>
      <Typography variant="h4" gutterBottom>
        사용자 관리
      </Typography>

      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}

      {loading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '200px' }}>
          <CircularProgress />
        </Box>
      ) : (
        <>
          <TableContainer component={Paper}>
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell>이메일</TableCell>
                  <TableCell>이름</TableCell>
                  <TableCell>소속</TableCell>
                  <TableCell>역할</TableCell>
                  <TableCell>상태</TableCell>
                  <TableCell>가입일</TableCell>
                  <TableCell>작업</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {users.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} align="center">
                      사용자가 없습니다.
                    </TableCell>
                  </TableRow>
                ) : (
                  users.map((user) => (
                    <TableRow key={user.id}>
                      <TableCell>{user.email}</TableCell>
                      <TableCell>{user.name}</TableCell>
                      <TableCell>{user.organization}</TableCell>
                      <TableCell>{user.role === 'admin' ? '관리자' : '일반 사용자'}</TableCell>
                      <TableCell>{user.is_active ? '활성' : '비활성'}</TableCell>
                      <TableCell>{new Date(user.created_at).toLocaleDateString()}</TableCell>
                      <TableCell>
                        <IconButton onClick={() => handleEditClick(user)} size="small">
                          <EditIcon />
                        </IconButton>
                        <IconButton onClick={() => handleDeleteClick(user.id)} size="small" color="error">
                          <DeleteIcon />
                        </IconButton>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </TableContainer>

          {users.length > 0 && (
            <Box sx={{ display: 'flex', justifyContent: 'center', mt: 2 }}>
              <Pagination
                count={Math.ceil(totalUsers / rowsPerPage)}
                page={page}
                onChange={handlePageChange}
                color="primary"
              />
            </Box>
          )}
        </>
      )}

      <EditDialog
        open={editDialogOpen}
        user={selectedUser}
        onClose={() => setEditDialogOpen(false)}
        onSave={handleEditSave}
      />
    </Box>
  );
};

export default UserManagement; 