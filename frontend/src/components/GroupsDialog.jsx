import { useEffect, useRef, useState } from 'react';
import { PALETTE, novoId } from '../groups.js';

export function GroupsDialog({ groups, onSave, onClose }) {
  const dialog = useRef(null);
  const [rascunho, setRascunho] = useState(groups);
  const [prefixoNovo, setPrefixoNovo] = useState({});
  const [erro, setErro] = useState(null);

  useEffect(() => {
    dialog.current?.showModal();
  }, []);

  const trocar = (id, mudanca) =>
    setRascunho((atual) => atual.map((g) => (g.id === id ? { ...g, ...mudanca } : g)));

  const mover = (indice, passo) =>
    setRascunho((atual) => {
      const lista = [...atual];
      const destino = indice + passo;
      if (destino < 0 || destino >= lista.length) return atual;
      [lista[indice], lista[destino]] = [lista[destino], lista[indice]];
      return lista;
    });

  const criarGrupo = () =>
    setRascunho((atual) => {
      const novo = {
        id: novoId('grupo'),
        name: 'Novo grupo',
        color: PALETTE[atual.length % PALETTE.length],
        removable: true,
        rules: [],
      };
      const fim = atual.filter((g) => !g.removable);
      return [...atual.filter((g) => g.removable), novo, ...fim];
    });

  const adicionarRegra = (id) => {
    const valor = (prefixoNovo[id] ?? '').trim();
    if (!valor) return;
    trocar(id, {
      rules: [
        ...(rascunho.find((g) => g.id === id)?.rules ?? []),
        { id: novoId('r'), type: 'pathPrefix', value: valor },
      ],
    });
    setPrefixoNovo((atual) => ({ ...atual, [id]: '' }));
  };

  const removerRegra = (id, regraId) =>
    trocar(id, { rules: rascunho.find((g) => g.id === id).rules.filter((r) => r.id !== regraId) });

  const fechar = () => {
    dialog.current?.close();
    onClose();
  };

  const salvar = async () => {
    setErro(null);
    try {
      await onSave(rascunho);
      fechar();
    } catch (failure) {
      setErro(failure.message);
    }
  };

  return (
    <dialog ref={dialog} className="groups-dialog" onCancel={fechar}>
      <header className="dialog-header groups-dialog-header">
        <span>Grupos</span>
        <button type="button" className="dialog-close" onClick={criarGrupo}>
          novo grupo
        </button>
      </header>

      <div className="dialog-body">
        {erro && <p role="alert">{erro}</p>}
        {rascunho.map((grupo, indice) => (
          <section key={grupo.id} className="grupo-edit">
            <div className="grupo-edit-topo">
              <input
                type="color"
                value={grupo.color}
                onChange={(evento) => trocar(grupo.id, { color: evento.target.value })}
                aria-label={`Cor de ${grupo.name}`}
              />
              <input
                type="text"
                value={grupo.name}
                onChange={(evento) => trocar(grupo.id, { name: evento.target.value })}
                aria-label="Nome do grupo"
              />
              <button type="button" onClick={() => mover(indice, -1)} title="Subir">
                ↑
              </button>
              <button type="button" onClick={() => mover(indice, 1)} title="Descer">
                ↓
              </button>
              {grupo.removable && (
                <button
                  type="button"
                  className="grupo-remover"
                  onClick={() => setRascunho((atual) => atual.filter((g) => g.id !== grupo.id))}
                >
                  remover
                </button>
              )}
            </div>

            <ul className="regras">
              {grupo.rules.map((regra) => (
                <li key={regra.id}>
                  <span className="regra-tipo">{regra.type === 'session' ? 'sessão' : 'pasta'}</span>
                  <code title={regra.value}>{regra.value}</code>
                  <button type="button" onClick={() => removerRegra(grupo.id, regra.id)}>
                    ×
                  </button>
                </li>
              ))}
              {grupo.rules.length === 0 && <li className="regras-vazio">sem regras</li>}
            </ul>

            <div className="regra-nova">
              <input
                type="text"
                placeholder="D:\caminho\da\pasta"
                value={prefixoNovo[grupo.id] ?? ''}
                onChange={(evento) =>
                  setPrefixoNovo((atual) => ({ ...atual, [grupo.id]: evento.target.value }))
                }
                onKeyDown={(evento) => evento.key === 'Enter' && adicionarRegra(grupo.id)}
              />
              <button type="button" onClick={() => adicionarRegra(grupo.id)}>
                adicionar pasta
              </button>
            </div>
          </section>
        ))}
      </div>

      <footer className="groups-dialog-footer">
        <button type="button" className="fechar" onClick={fechar}>
          fechar
        </button>
        <button type="button" className="salvar" onClick={salvar}>
          salvar
        </button>
      </footer>
    </dialog>
  );
}
