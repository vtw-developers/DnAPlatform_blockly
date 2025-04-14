import React, { useState } from 'react';
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
  Chip
} from '@mui/material';
import EditIcon from '@mui/icons-material/Edit';
import BlockIcon from '@mui/icons-material/Block';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';

interface User {
  id: number;
  email: string;
  name: string;
  organization: string;
  role: 'admin' | 'user';
  status: 'active' | 'inactive';
  createdAt: string;
}

const UserManagement = () => {
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);

  // 임시 데이터
  const users: User[] = [
    {
      id: 1,
      email: 'admin@example.com',
      name: '관리자',
      organization: '시스템 관리부',
      role: 'admin',
      status: 'active',
      createdAt: '2024-01-01'
    },
    {
      id: 2,
      email: 'user@example.com',
      name: '홍길동',
      organization: 'ABC 기관',
      role: 'user',
      status: 'active',
      createdAt: '2024-01-02'
    }
  ];

  const handleChangePage = (event: unknown, newPage: number) => {
    setPage(newPage);
  };

  const handleChangeRowsPerPage = (event: React.ChangeEvent<HTMLInputElement>) => {
    setRowsPerPage(parseInt(event.target.value, 10));
    setPage(0);
  };

  const handleEditClick = (user: User) => {
    setSelectedUser(user);
    setEditDialogOpen(true);
  };

  const handleStatusToggle = (user: User) => {
    // TODO: 사용자 상태 변경 처리
    console.log('Toggle status for user:', user.id);
  };

  const handleEditDialogClose = () => {
    setEditDialogOpen(false);
    setSelectedUser(null);
  };

  const handleEditSubmit = () => {
    // TODO: 사용자 정보 업데이트 처리
    handleEditDialogClose();
  };

  return (
    <Box sx={{ width: '100%', p: 3 }}>
      <Typography variant="h4" sx={{ mb: 3 }}>
        사용자 관리
      </Typography>
      
      <Paper sx={{ width: '100%', mb: 2 }}>
        <TableContainer>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>이메일</TableCell>
                <TableCell>이름</TableCell>
                <TableCell>소속</TableCell>
                <TableCell>권한</TableCell>
                <TableCell>상태</TableCell>
                <TableCell>가입일</TableCell>
                <TableCell>관리</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {users
                .slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage)
                .map((user) => (
                  <TableRow key={user.id}>
                    <TableCell>{user.email}</TableCell>
                    <TableCell>{user.name}</TableCell>
                    <TableCell>{user.organization}</TableCell>
                    <TableCell>
                      <Chip
                        label={user.role === 'admin' ? '관리자' : '사용자'}
                        color={user.role === 'admin' ? 'primary' : 'default'}
                        size="small"
                      />
                    </TableCell>
                    <TableCell>
                      <Chip
                        label={user.status === 'active' ? '활성' : '비활성'}
                        color={user.status === 'active' ? 'success' : 'error'}
                        size="small"
                      />
                    </TableCell>
                    <TableCell>{user.createdAt}</TableCell>
                    <TableCell>
                      <IconButton
                        size="small"
                        onClick={() => handleEditClick(user)}
                      >
                        <EditIcon />
                      </IconButton>
                      <IconButton
                        size="small"
                        onClick={() => handleStatusToggle(user)}
                      >
                        {user.status === 'active' ? (
                          <BlockIcon color="error" />
                        ) : (
                          <CheckCircleIcon color="success" />
                        )}
                      </IconButton>
                    </TableCell>
                  </TableRow>
                ))}
            </TableBody>
          </Table>
        </TableContainer>
        <TablePagination
          rowsPerPageOptions={[5, 10, 25]}
          component="div"
          count={users.length}
          rowsPerPage={rowsPerPage}
          page={page}
          onPageChange={handleChangePage}
          onRowsPerPageChange={handleChangeRowsPerPage}
        />
      </Paper>

      <Dialog open={editDialogOpen} onClose={handleEditDialogClose}>
        <DialogTitle>사용자 정보 수정</DialogTitle>
        <DialogContent>
          <Box sx={{ pt: 2 }}>
            <TextField
              fullWidth
              label="이메일"
              value={selectedUser?.email}
              disabled
              sx={{ mb: 2 }}
            />
            <TextField
              fullWidth
              label="이름"
              value={selectedUser?.name}
              sx={{ mb: 2 }}
            />
            <TextField
              fullWidth
              label="소속"
              value={selectedUser?.organization}
              sx={{ mb: 2 }}
            />
            <FormControl fullWidth sx={{ mb: 2 }}>
              <InputLabel>권한</InputLabel>
              <Select
                value={selectedUser?.role}
                label="권한"
              >
                <MenuItem value="admin">관리자</MenuItem>
                <MenuItem value="user">사용자</MenuItem>
              </Select>
            </FormControl>
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleEditDialogClose}>취소</Button>
          <Button onClick={handleEditSubmit} variant="contained">
            저장
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default UserManagement; 