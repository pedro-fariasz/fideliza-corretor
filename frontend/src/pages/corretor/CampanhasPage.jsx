// Campanhas — histórico de disparos por canal (tabela historico_disparos).
// Os disparos automáticos (e-mail/WhatsApp) são das Fases 2 e 3; em Fase 1 ainda
// não há endpoint nem dados. Tela honesta: mostra o que virá, sem inventar dados
// nem puxar escopo de fase futura (ver CLAUDE.md — não pular fases).
export default function CampanhasPage() {
  return (
    <div className="animate-rise rounded-2xl border border-gray-100 bg-white p-8 text-center shadow-sm dark:border-white/10 dark:bg-white/5">
      <p className="font-heading text-lg font-semibold text-brand-navy dark:text-white">
        Histórico de campanhas
      </p>
      <p className="mx-auto mt-2 max-w-md text-sm text-gray-500 dark:text-gray-400">
        Aqui você vai acompanhar cada mensagem disparada por WhatsApp e e-mail
        (aniversários, boletos, follow-ups). Os disparos automáticos entram nas
        próximas fases do produto — quando começarem, este histórico se preenche
        sozinho.
      </p>
      <span className="mt-4 inline-block rounded-full bg-brand-amber/15 px-3 py-1 text-xs font-semibold text-brand-amber">
        Disponível nas Fases 2 e 3
      </span>
    </div>
  );
}
