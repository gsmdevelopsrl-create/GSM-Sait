import Link from "next/link";
import { Logo } from "@/components/Logo";
import { LeadForm } from "@/components/landing/LeadForm";

const clients = ["Ромашка", "ТД Север", "Аптека Плюс", "ЛогистикПро", "ФинГрупп"];

const services = [
  { emoji: "🚀", title: "Внедрение", desc: "Запуск и настройка типовых конфигураций 1С под ваши процессы." },
  { emoji: "🛠", title: "Доработка", desc: "Отчёты, обработки, печатные формы и бизнес-логика под задачи." },
  { emoji: "🛟", title: "Поддержка", desc: "Сопровождение и оперативное решение инцидентов." },
  { emoji: "🎓", title: "Обучение", desc: "Обучение сотрудников работе в 1С." },
  { emoji: "🔗", title: "Интеграции", desc: "Обмен с сайтами, CRM, банками и сервисами." },
  { emoji: "♻️", title: "Обновления", desc: "Обновление платформы без потери доработок." },
];

const steps = [
  { n: "1", title: "Заявка", desc: "Опишите задачу в кабинете с вложениями." },
  { n: "2", title: "Оценка", desc: "Согласуем сроки, часы и стоимость." },
  { n: "3", title: "Работа", desc: "Выполняем, вы видите статус онлайн." },
  { n: "4", title: "Приёмка", desc: "Проверка и сдача результата." },
];

const reviews = [
  { text: "Перевели учёт на 1С за месяц, заявки ведём в кабинете — всё прозрачно.", name: "Мария Котова", company: "ООО «Ромашка»", ini: "МК" },
  { text: "Интеграцию с сайтом сделали в срок, поддержка отвечает быстро.", name: "Ольга Пряхина", company: "ТД «Север»", ini: "ОП" },
  { text: "Настроили ЗУП и обучили бухгалтерию. Надёжный подрядчик.", name: "Сергей Тимохин", company: "Аптека «Плюс»", ini: "СТ" },
];

const nav = [
  ["#uslugi", "Услуги"],
  ["#steps", "Как работаем"],
  ["#otzyvy", "Отзывы"],
  ["#about", "О компании"],
  ["#contacts", "Контакты"],
];

export default function LandingPage() {
  return (
    <div className="min-h-screen">
      {/* Шапка + Hero */}
      <div className="mx-auto max-w-[1160px] px-[30px]">
        <header className="flex items-center justify-between py-[22px]">
          <div className="flex items-center gap-3">
            <Logo />
            <span className="text-base font-extrabold">GSM Developer SRL</span>
          </div>
          <nav className="flex items-center gap-7">
            {nav.map(([href, label]) => (
              <a key={href} href={href} className="hidden text-sm font-semibold text-slate hover:text-brand md:inline">
                {label}
              </a>
            ))}
            <Link href="/login" className="rounded-full bg-brand px-[22px] py-[11px] text-sm font-bold text-white transition hover:bg-brand-dark">
              Личный кабинет
            </Link>
          </nav>
        </header>

        <section className="grid grid-cols-1 items-center gap-11 py-14 md:grid-cols-2">
          <div>
            <div className="mb-[22px] inline-flex items-center gap-2 rounded-full bg-mint px-[15px] py-2 text-[13px] font-bold text-brand-dark">
              💬 Отвечаем в течение часа
            </div>
            <h1 className="mb-5 text-[40px] font-extrabold leading-[1.06] tracking-[-1.5px] md:text-[54px]">
              1С, которая помогает,<br />а не мешает работать
            </h1>
            <p className="mb-[30px] max-w-[500px] text-lg leading-[1.6] text-slate">
              Внедрение, доработка, поддержка и интеграции. Оставляйте заявки на доработку в личном кабинете — с вложениями и понятным статусом.
            </p>
            <div className="flex flex-wrap gap-3.5">
              <Link href="/login" className="rounded-[14px] bg-brand px-[30px] py-[15px] text-[15px] font-bold text-white shadow-[0_10px_24px_rgba(15,157,140,.3)] transition hover:bg-brand-dark">
                Оставить заявку
              </Link>
              <a href="#uslugi" className="rounded-[14px] border-[1.5px] border-[#c3d8d1] bg-white px-7 py-3.5 text-[15px] font-bold text-ink">
                Услуги
              </a>
            </div>
          </div>
          <div className="rounded-3xl border border-[#d3e6e0] bg-gradient-to-br from-[#dff2ee] to-canvas p-[26px]">
            <div className="mb-3.5 rounded-2xl bg-white p-5 shadow-[0_10px_30px_rgba(21,42,36,.08)]">
              <div className="mb-3 flex items-center justify-between">
                <span className="text-sm font-extrabold">Заявка #1043</span>
                <span className="rounded-full bg-[#d9f2e3] px-3 py-[5px] text-xs font-bold text-[#1a9d55]">В работе</span>
              </div>
              <div className="mb-2.5 text-[15px] font-bold">Доработка отчёта по продажам</div>
              <div className="h-2 overflow-hidden rounded-full bg-canvas">
                <div className="h-full w-[65%] bg-brand" />
              </div>
            </div>
            <div className="flex items-center gap-3 rounded-2xl bg-white px-5 py-4 shadow-[0_10px_30px_rgba(21,42,36,.06)]">
              <div className="grid h-[38px] w-[38px] place-items-center rounded-full bg-mint font-bold text-brand-dark">АИ</div>
              <div className="text-[13px]">
                <b>Артём</b> взял в работу · оценка 16ч
              </div>
            </div>
          </div>
        </section>
      </div>

      {/* Лента клиентов */}
      <div className="border-y border-[#e2ede9] bg-white">
        <div className="mx-auto flex max-w-[1160px] flex-wrap items-center justify-center gap-9 px-[30px] py-[22px] text-sm font-semibold text-muted">
          <span>Нам доверяют:</span>
          {clients.map((c) => (
            <span key={c} className="text-base font-extrabold text-slate">{c}</span>
          ))}
        </div>
      </div>

      <div className="mx-auto max-w-[1160px] px-[30px]">
        {/* Услуги */}
        <section id="uslugi" className="pb-10 pt-[70px]">
          <h2 className="mb-2 text-center text-[38px] font-extrabold tracking-[-1px]">Услуги</h2>
          <p className="mb-9 text-center text-base text-muted">Полный цикл работ по 1С</p>
          <div className="grid grid-cols-1 gap-[18px] sm:grid-cols-2 lg:grid-cols-3">
            {services.map((s) => (
              <div key={s.title} className="rounded-[20px] border border-line bg-white p-[26px] transition hover:-translate-y-1 hover:shadow-[0_18px_40px_rgba(21,42,36,.1)]">
                <div className="mb-4 grid h-12 w-12 place-items-center rounded-[14px] bg-mint text-[22px]">{s.emoji}</div>
                <div className="mb-2 text-[19px] font-extrabold">{s.title}</div>
                <div className="text-sm leading-[1.55] text-slate">{s.desc}</div>
              </div>
            ))}
          </div>
        </section>

        {/* Как работаем */}
        <section id="steps" className="py-14">
          <h2 className="mb-9 text-center text-[38px] font-extrabold tracking-[-1px]">Как мы работаем</h2>
          <div className="grid grid-cols-2 gap-[18px] lg:grid-cols-4">
            {steps.map((st) => (
              <div key={st.n} className="text-center">
                <div className="mx-auto mb-4 grid h-14 w-14 place-items-center rounded-full bg-brand text-xl font-extrabold text-white">{st.n}</div>
                <div className="mb-1.5 text-[17px] font-extrabold">{st.title}</div>
                <div className="text-sm leading-[1.5] text-slate">{st.desc}</div>
              </div>
            ))}
          </div>
        </section>

        {/* О компании */}
        <section id="about" className="grid grid-cols-1 items-center gap-12 py-14 md:grid-cols-2">
          <div className="grid h-[340px] place-items-center rounded-3xl border border-[#d3e6e0] bg-gradient-to-br from-[#dff2ee] to-canvas">
            <span className="font-mono text-[13px] text-[#8fada5]">[ фото команды / офиса ]</span>
          </div>
          <div>
            <h2 className="mb-[18px] text-[38px] font-extrabold tracking-[-1px]">О компании</h2>
            <p className="mb-4 text-[17px] leading-[1.75] text-slate">
              GSM Developer SRL — команда сертифицированных специалистов 1С. Помогаем компаниям автоматизировать учёт, дорабатывать типовые конфигурации под процессы и держать систему в стабильной работе.
            </p>
            <p className="mb-[22px] text-[17px] leading-[1.75] text-slate">
              Работаем прозрачно: каждая заявка на доработку ведётся в личном кабинете со статусом, оценкой часов и перепиской.
            </p>
            <div className="flex gap-7">
              {[["12+", "лет с 1С"], ["240+", "проектов"], ["98%", "заявок в срок"]].map(([v, l]) => (
                <div key={l}>
                  <div className="text-[26px] font-extrabold text-brand">{v}</div>
                  <div className="text-[13px] font-semibold text-muted">{l}</div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Отзывы */}
        <section id="otzyvy" className="pb-14 pt-10">
          <h2 className="mb-9 text-center text-[38px] font-extrabold tracking-[-1px]">Отзывы клиентов</h2>
          <div className="grid grid-cols-1 gap-[18px] md:grid-cols-3">
            {reviews.map((r) => (
              <div key={r.name} className="rounded-[20px] border border-line bg-white p-[26px]">
                <div className="mb-3 tracking-[2px] text-[15px] text-accent">★★★★★</div>
                <p className="mb-[18px] text-[15px] leading-[1.6] text-[#2b3d37]">«{r.text}»</p>
                <div className="flex items-center gap-3">
                  <div className="grid h-10 w-10 place-items-center rounded-full bg-mint font-bold text-brand-dark">{r.ini}</div>
                  <div>
                    <div className="text-sm font-bold">{r.name}</div>
                    <div className="text-xs text-muted">{r.company}</div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>
      </div>

      {/* Контакты + форма */}
      <section id="contacts" className="mx-auto max-w-[1160px] px-[30px] pb-20 pt-5">
        <div className="grid grid-cols-1 gap-12 rounded-3xl bg-brand p-8 text-white md:grid-cols-2 md:p-12">
          <div>
            <h2 className="mb-3.5 text-[34px] font-extrabold tracking-[-1px]">Оставьте заявку</h2>
            <p className="mb-[26px] text-base leading-[1.6] text-[#d3f0eb]">
              Опишите задачу — вернёмся с оценкой сроков и стоимости.
            </p>
            <div className="flex flex-col gap-3 text-base font-semibold">
              <a href="mailto:gsmdevelopersrl@gmail.com" className="text-white hover:text-white">✉ gsmdevelopersrl@gmail.com</a>
              <a href="tel:+37379059039" className="text-white hover:text-white">☎ +373 79 059 039</a>
            </div>
          </div>
          <LeadForm />
        </div>
        <div className="mt-[30px] text-center text-[13px] text-muted">
          © 2026 GSM Developer SRL · Услуги в сфере 1С
        </div>
      </section>
    </div>
  );
}
