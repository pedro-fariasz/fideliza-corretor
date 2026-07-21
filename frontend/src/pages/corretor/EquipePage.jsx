import { useEffect, useState } from 'react';
import { api } from '../../services/api';
import { useAuth } from '../../hooks/useAuth';
import Modal from '../../components/Modal';
import FormField from '../../components/FormField';
import { formatDataHora } from '../../utils/format';

const PAPEL_LABEL = { administrador: 'Administrador', corretor: 'Corretor', secretaria: 'Secretária' };
const CARGO_LABEL = { vendedor: 'Vendedor', lider: 'Líder', gerente: 'Gerente' };
const CARGOS = [
  { value: 'vendedor', label: 'Vendedor' },
  { value: 'lider', label: 'Líder de Equipe' },
  { value: 'gerente', label: 'Gerente Geral' },
];

const NOVO_VAZIO = { nome: '', email: '', senha: '', confirmarSenha: '', cargo: 'vendedor', lider_id: '' };

export default function EquipePage() {
  const { profile } = useAuth();
  const [usuarios, setUsuarios] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [novoTipo, setNovoTipo] = useState(null); // 'corretor' | 'secretaria'
  const [novoForm, setNovoForm] = useState(NOVO_VAZIO);
  const [editUser, setEditUser] = useState(null);
  const [desativarUser, setDesativarUser] = useState(null);
  const [transferParaId, setTransferParaId] = useState('');
  const [salvando, setSalvando] = useState(false);
  const [formErro, setFormErro] = useState('');

  async function carregar() {
    setLoading(true);
    setError('');
    try {
      const data = await api.listarEquipe();
      setUsuarios(Array.isArray(data) ? data : []);
    } catch (err) {
      setError(err.message || 'Erro ao carregar a equipe.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    carregar();
  }, []);

  const lideres = usuarios.filter((u) => ['lider', 'gerente'].includes(u.cargo) && u.ativo);
  const ativosParaTransferir = usuarios.filter((u) => u.ativo);

  function onNovoChange(e) {
    const { name, value } = e.target;
    setNovoForm((f) => ({ ...f, [name]: value }));
  }

  async function salvarNovo() {
    setSalvando(true);
    setFormErro('');
    try {
      const base = {
        nome: novoForm.nome,
        email: novoForm.email,
        senha: novoForm.senha,
        confirmarSenha: novoForm.confirmarSenha,
      };
      if (novoTipo === 'corretor') {
        await api.criarCorretorEquipe({
          ...base,
          cargo: novoForm.cargo,
          lider_id: novoForm.cargo === 'vendedor' ? novoForm.lider_id || null : null,
        });
      } else {
        await api.criarSecretaria(base);
      }
      setNovoTipo(null);
      setNovoForm(NOVO_VAZIO);
      await carregar();
    } catch (err) {
      setFormErro(err.message || 'Erro ao criar o usuário.');
    } finally {
      setSalvando(false);
    }
  }

  async function salvarEdicao() {
    setSalvando(true);
    setFormErro('');
    try {
      await api.editarUsuario(editUser.id, {
        nome: editUser.nome,
        papel_conta: editUser.papel_conta,
        cargo: editUser.papel_conta === 'corretor' ? editUser.cargo : null,
        lider_id: editUser.cargo === 'vendedor' ? editUser.lider_id || null : null,
        ativo: editUser.ativo,
      });
      setEditUser(null);
      await carregar();
    } catch (err) {
      setFormErro(err.message || 'Erro ao salvar.');
    } finally {
      setSalvando(false);
    }
  }

  async function confirmarDesativar() {
    setSalvando(true);
    setFormErro('');
    try {
      await api.desativarUsuario(desativarUser.id, transferParaId || null);
      setDesativarUser(null);
      setTransferParaId('');
      await carregar();
    } catch (err) {
      setFormErro(err.message || 'Erro ao desativar.');
    } finally {
      setSalvando(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-gray-500 dark:text-gray-400">Usuários da sua conta e seus acessos.</p>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => {
              setNovoTipo('corretor');
              setNovoForm(NOVO_VAZIO);
              setFormErro('');
            }}
            className="rounded-lg bg-brand-blue px-4 py-2 text-sm font-semibold text-white hover:bg-brand-blue-dark"
          >
            + Corretor
          </button>
          <button
            type="button"
            onClick={() => {
              setNovoTipo('secretaria');
              setNovoForm(NOVO_VAZIO);
              setFormErro('');
            }}
            className="rounded-lg border border-brand-blue px-4 py-2 text-sm font-semibold text-brand-blue hover:bg-brand-blue/5"
          >
            + Secretária
          </button>
        </div>
      </div>

      {loading ? (
        <p className="py-12 text-center text-gray-500 dark:text-gray-400">Carregando...</p>
      ) : error ? (
        <div className="rounded-md bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>
      ) : (
        <div className="overflow-x-auto rounded-xl bg-white shadow-sm dark:bg-white/5 dark:ring-1 dark:ring-white/10">
          <table className="min-w-full divide-y divide-gray-200 dark:divide-white/10">
            <thead>
              <tr className="text-left text-xs uppercase tracking-wide text-gray-400">
                <th className="px-4 py-3">Nome</th>
                <th className="px-4 py-3">Papel</th>
                <th className="px-4 py-3">Cargo</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Último acesso</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 text-sm dark:divide-white/5">
              {usuarios.map((u) => (
                <tr key={u.id}>
                  <td className="px-4 py-3">
                    <div className="font-medium text-brand-navy dark:text-white">{u.nome || '—'}</div>
                    <div className="text-xs text-gray-400">{u.email}</div>
                  </td>
                  <td className="px-4 py-3 text-gray-500 dark:text-gray-400">{PAPEL_LABEL[u.papel_conta] || '—'}</td>
                  <td className="px-4 py-3 text-gray-500 dark:text-gray-400">{CARGO_LABEL[u.cargo] || '—'}</td>
                  <td className="px-4 py-3">
                    {u.ativo ? (
                      <span className="rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-700">Ativo</span>
                    ) : (
                      <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-500">Inativo</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-gray-400">{u.ultimo_acesso ? formatDataHora(u.ultimo_acesso) : '—'}</td>
                  <td className="px-4 py-3 text-right">
                    <button
                      type="button"
                      onClick={() => {
                        setEditUser({ ...u, lider_id: u.lider_id || '' });
                        setFormErro('');
                      }}
                      className="mr-3 text-sm font-medium text-brand-blue hover:text-brand-blue-dark"
                    >
                      Editar
                    </button>
                    {u.id !== profile.id && u.ativo && (
                      <button
                        type="button"
                        onClick={() => {
                          setDesativarUser(u);
                          setTransferParaId('');
                          setFormErro('');
                        }}
                        className="text-sm font-medium text-gray-400 hover:text-red-600"
                      >
                        Desativar
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Modal: novo corretor / secretária */}
      <Modal
        open={!!novoTipo}
        onClose={() => setNovoTipo(null)}
        title={novoTipo === 'secretaria' ? 'Nova secretária' : 'Novo corretor'}
        footer={
          <>
            <button type="button" onClick={() => setNovoTipo(null)} className="rounded-lg px-4 py-2 text-sm font-medium text-gray-500 hover:text-gray-800 dark:text-gray-300">
              Cancelar
            </button>
            <button type="button" onClick={salvarNovo} disabled={salvando} className="rounded-lg bg-brand-blue px-4 py-2 text-sm font-semibold text-white hover:bg-brand-blue-dark disabled:opacity-60">
              {salvando ? 'Salvando...' : 'Criar'}
            </button>
          </>
        }
      >
        <div className="space-y-4">
          <FormField label="Nome completo" name="nome" value={novoForm.nome} onChange={onNovoChange} required />
          <FormField label="E-mail" name="email" type="email" value={novoForm.email} onChange={onNovoChange} required />
          <div className="grid grid-cols-2 gap-3">
            <FormField label="Senha" name="senha" type="password" value={novoForm.senha} onChange={onNovoChange} required />
            <FormField label="Confirmar senha" name="confirmarSenha" type="password" value={novoForm.confirmarSenha} onChange={onNovoChange} required />
          </div>
          {novoTipo === 'corretor' && (
            <>
              <FormField label="Cargo na hierarquia" name="cargo" value={novoForm.cargo} onChange={onNovoChange} options={CARGOS} required />
              {novoForm.cargo === 'vendedor' && (
                <FormField
                  label="Líder (opcional)"
                  name="lider_id"
                  value={novoForm.lider_id}
                  onChange={onNovoChange}
                  options={lideres.map((l) => ({ value: l.id, label: `${l.nome} (${CARGO_LABEL[l.cargo]})` }))}
                />
              )}
            </>
          )}
          <p className="text-xs text-gray-400">A senha inicial é definida por você e não é enviada por e-mail. Combine com a pessoa como repassá-la.</p>
          {formErro && <p className="text-sm text-red-600">{formErro}</p>}
        </div>
      </Modal>

      {/* Modal: editar */}
      <Modal
        open={!!editUser}
        onClose={() => setEditUser(null)}
        title="Editar usuário"
        footer={
          <>
            <button type="button" onClick={() => setEditUser(null)} className="rounded-lg px-4 py-2 text-sm font-medium text-gray-500 hover:text-gray-800 dark:text-gray-300">
              Cancelar
            </button>
            <button type="button" onClick={salvarEdicao} disabled={salvando} className="rounded-lg bg-brand-blue px-4 py-2 text-sm font-semibold text-white hover:bg-brand-blue-dark disabled:opacity-60">
              {salvando ? 'Salvando...' : 'Salvar'}
            </button>
          </>
        }
      >
        {editUser && (
          <div className="space-y-4">
            <FormField label="Nome" name="nome" value={editUser.nome || ''} onChange={(e) => setEditUser((u) => ({ ...u, nome: e.target.value }))} required />
            <FormField
              label="Papel"
              name="papel_conta"
              value={editUser.papel_conta}
              onChange={(e) => setEditUser((u) => ({ ...u, papel_conta: e.target.value }))}
              options={[
                { value: 'administrador', label: 'Administrador' },
                { value: 'corretor', label: 'Corretor' },
                { value: 'secretaria', label: 'Secretária' },
              ]}
            />
            {editUser.papel_conta === 'corretor' && (
              <>
                <FormField label="Cargo" name="cargo" value={editUser.cargo || 'vendedor'} onChange={(e) => setEditUser((u) => ({ ...u, cargo: e.target.value }))} options={CARGOS} />
                {editUser.cargo === 'vendedor' && (
                  <FormField
                    label="Líder"
                    name="lider_id"
                    value={editUser.lider_id || ''}
                    onChange={(e) => setEditUser((u) => ({ ...u, lider_id: e.target.value }))}
                    options={lideres.filter((l) => l.id !== editUser.id).map((l) => ({ value: l.id, label: `${l.nome} (${CARGO_LABEL[l.cargo]})` }))}
                  />
                )}
              </>
            )}
            <label className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
              <input type="checkbox" checked={!!editUser.ativo} onChange={(e) => setEditUser((u) => ({ ...u, ativo: e.target.checked }))} className="h-4 w-4" />
              Usuário ativo
            </label>
            {formErro && <p className="text-sm text-red-600">{formErro}</p>}
          </div>
        )}
      </Modal>

      {/* Modal: desativar + transferir carteira */}
      <Modal
        open={!!desativarUser}
        onClose={() => setDesativarUser(null)}
        title={`Desativar ${desativarUser ? desativarUser.nome || desativarUser.email : ''}`}
        footer={
          <>
            <button type="button" onClick={() => setDesativarUser(null)} className="rounded-lg px-4 py-2 text-sm font-medium text-gray-500 hover:text-gray-800 dark:text-gray-300">
              Cancelar
            </button>
            <button type="button" onClick={confirmarDesativar} disabled={salvando} className="rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-60">
              {salvando ? 'Desativando...' : 'Desativar'}
            </button>
          </>
        }
      >
        <div className="space-y-4">
          <p className="text-sm text-gray-600 dark:text-gray-300">
            O acesso é bloqueado, mas <strong>nada é apagado</strong>. Você pode transferir a carteira (leads, vendas e
            compromissos) para outro usuário ativo.
          </p>
          {desativarUser && (
            <FormField
              label="Transferir carteira para (opcional)"
              name="transferir"
              value={transferParaId}
              onChange={(e) => setTransferParaId(e.target.value)}
              options={ativosParaTransferir.filter((u) => u.id !== desativarUser.id).map((u) => ({ value: u.id, label: u.nome || u.email }))}
            />
          )}
          {formErro && <p className="text-sm text-red-600">{formErro}</p>}
        </div>
      </Modal>
    </div>
  );
}
