import React, { useEffect, useRef, useState } from 'react';
import styled from 'styled-components';
import { AnimatePresence, motion } from 'framer-motion';

type Message = { role: 'user' | 'assistant'; text: string };
type HelpTopic = { question: string; answer: string; keywords: string[] };

const helpTopics: HelpTopic[] = [
  {
    question: 'What is CircuNet?',
    answer: 'CircuNet is a circular economy marketplace that connects suppliers of recyclable or reusable materials with buyers looking for those materials.',
    keywords: ['what is circunet', 'about circunet', 'what does circunet do', 'purpose of circunet'],
  },
  {
    question: 'How does CircuNet work?',
    answer: 'Suppliers create material listings with details such as category, material type, quantity, quality and location. Buyers create requirements describing what they need. CircuNet then identifies compatible opportunities based on the available listing and requirement information.',
    keywords: ['how does circunet work', 'how it works', 'how the marketplace works', 'platform work'],
  },
  {
    question: 'How do I create a listing?',
    answer: 'Go to the Listings section and create a new listing. Provide the material category, material type, quantity, price, location and relevant quality information. Make sure the details are accurate before submitting.',
    keywords: ['create listing', 'new listing', 'list material', 'sell material', 'post material', 'publish listing'],
  },
  {
    question: 'How do I create a buyer requirement?',
    answer: 'Go to the Buyer Requirements section and create a requirement. Specify the material category, material type, minimum quantity, quality requirements, location and maximum acceptable distance.',
    keywords: ['buyer requirement', 'create requirement', 'add requirement', 'material requirement', 'what should a buyer specify'],
  },
  {
    question: 'How does matching work?',
    answer: 'CircuNet compares buyer requirements with supplier listings using factors such as material category, material type, available quantity, quality properties and distance. Only compatible opportunities are shown.',
    keywords: ['matching', 'compatible buyer', 'compatible listing', 'match buyer', 'match listing', 'distance limit', 'quality match'],
  },
  {
    question: 'What is CO₂e savings?',
    answer: 'CO₂e savings is an estimate of the greenhouse-gas emissions that may be avoided by reusing or recycling material instead of sending it to disposal, while accounting for estimated transportation emissions. These values are estimates and should not be treated as verified environmental measurements.',
    keywords: ['co2', 'co₂', 'carbon', 'emission', 'environmental saving', 'carbon saving'],
  },
  {
    question: 'How does the exchange process work?',
    answer: 'A buyer can initiate an exchange for a suitable listing. The other party can then review and approve or cancel the transaction. The exchange status is updated as the transaction progresses.',
    keywords: ['exchange process', 'request material', 'send request', 'exchange request', 'transaction', 'buy material'],
  },
  {
    question: 'How do I edit or close my listing?',
    answer: 'Open My Listings. Choose Edit listing to update its details, or Close listing to remove it from active marketplace listings.',
    keywords: ['edit listing', 'update listing', 'change listing', 'close listing', 'remove listing', 'deactivate listing'],
  },
  {
    question: 'How do I accept or decline an exchange request?',
    answer: 'Open Exchange requests. The listing owner can accept or decline a pending request there. A buyer can cancel a request they sent while it is still pending.',
    keywords: ['accept request', 'decline request', 'approve exchange', 'cancel request', 'respond to request'],
  },
  {
    question: 'Why is my CO₂e estimate unavailable?',
    answer: 'A CO₂e estimate needs coordinates for the listing and a saved buyer requirement, plus both emission factors configured by the site operator: transport emissions per tonne-kilometre and avoided-disposal emissions per kilogram. Estimates are indicative, not verified measurements.',
    keywords: ['co2 unavailable', 'co₂ unavailable', 'zero co2', 'zero carbon', 'missing emissions', 'emission factor', 'no co2 estimate'],
  },
];

const findAnswer = (question: string): string => {
  const normalized = question.toLowerCase().replace(/[^a-z0-9₂]+/g, ' ').trim();
  const topic = helpTopics
    .map((item) => ({ item, score: item.keywords.reduce((score, keyword) => {
      const term = keyword.toLowerCase().replace(/[^a-z0-9₂]+/g, ' ').trim();
      return normalized.includes(term) ? score + term.length : score;
    }, 0) }))
    .sort((a, b) => b.score - a.score)[0];
  return topic && topic.score > 0
    ? topic.item.answer
    : `I can help with CircuNet listings, buyer requirements, matching, CO₂e estimates and exchange requests. Try asking: “${helpTopics[2].question}” or “${helpTopics[6].question}”.`;
};

const Root = styled.div`position:fixed;right:1.5rem;bottom:1.5rem;z-index:1200;font-family:${({ theme }) => theme.typography.fontFamily};`;
const Toggle = styled.button`border:0;border-radius:999px;padding:.85rem 1.15rem;background:${({ theme }) => theme.colors.primary.main};color:#fff;font:inherit;font-weight:600;box-shadow:${({ theme }) => theme.shadows.lg};cursor:pointer;&:hover{background:${({ theme }) => theme.colors.primary.dark}}&:focus-visible{outline:3px solid ${({ theme }) => theme.colors.secondary.light};outline-offset:3px}`;
const Panel = styled(motion.section)`position:absolute;right:0;bottom:4.25rem;width:min(390px,calc(100vw - 2rem));max-height:min(600px,calc(100vh - 7rem));display:flex;flex-direction:column;overflow:hidden;border:1px solid ${({ theme }) => theme.colors.border};border-radius:16px;background:${({ theme }) => theme.colors.background.paper};box-shadow:${({ theme }) => theme.shadows.xl};`;
const Header = styled.header`padding:1rem 1.1rem;background:${({ theme }) => theme.colors.primary.main};color:#fff;`;
const HeaderRow = styled.div`display:flex;align-items:flex-start;justify-content:space-between;gap:1rem;`;
const Heading = styled.h2`margin:0;font-size:1.05rem;`;
const Subtitle = styled.p`margin:.25rem 0 0;font-size:.9rem;opacity:.9;`;
const Close = styled.button`border:0;background:transparent;color:#fff;font-size:1.4rem;line-height:1;cursor:pointer;border-radius:5px;padding:.1rem .3rem;&:focus-visible{outline:2px solid #fff;outline-offset:2px}`;
const Content = styled.div`padding:1rem;overflow-y:auto;`;
const QuestionList = styled.div`display:grid;gap:.55rem;`;
const QuestionButton = styled.button`width:100%;padding:.65rem .75rem;text-align:left;border:1px solid ${({ theme }) => theme.colors.border};border-radius:9px;background:${({ theme }) => theme.colors.background.paper};color:${({ theme }) => theme.colors.text.primary};font:inherit;cursor:pointer;&:hover{border-color:${({ theme }) => theme.colors.primary.main};background:${({ theme }) => theme.colors.background.default}}&:focus-visible{outline:3px solid ${({ theme }) => theme.colors.secondary.light};outline-offset:2px}`;
const Conversation = styled.div`display:grid;gap:.75rem;`;
const Bubble = styled.div<{ $role: Message['role'] }>`justify-self:${({ $role }) => $role === 'user' ? 'end' : 'start'};max-width:92%;padding:.7rem .85rem;border-radius:${({ $role }) => $role === 'user' ? '13px 13px 3px 13px' : '13px 13px 13px 3px'};background:${({ theme, $role }) => $role === 'user' ? theme.colors.primary.main : theme.colors.background.default};color:${({ theme, $role }) => $role === 'user' ? '#fff' : theme.colors.text.primary};font-size:.92rem;line-height:1.5;`;
const Back = styled.button`margin-top:1rem;padding:.55rem .7rem;border:1px solid ${({ theme }) => theme.colors.primary.main};border-radius:8px;background:transparent;color:${({ theme }) => theme.colors.primary.main};font:inherit;font-size:.9rem;cursor:pointer;&:hover{background:${({ theme }) => theme.colors.background.default}}&:focus-visible{outline:3px solid ${({ theme }) => theme.colors.secondary.light};outline-offset:2px}`;
const Composer = styled.form`display:flex;gap:.5rem;margin-top:1rem;padding-top:.75rem;border-top:1px solid ${({ theme }) => theme.colors.border};`;
const TextInput = styled.input`flex:1;min-width:0;padding:.7rem .75rem;border:1px solid ${({ theme }) => theme.colors.border};border-radius:9px;font:inherit;color:${({ theme }) => theme.colors.text.primary};&:focus{outline:2px solid ${({ theme }) => theme.colors.secondary.light};border-color:transparent}`;
const Send = styled.button`padding:.65rem .85rem;border:0;border-radius:9px;background:${({ theme }) => theme.colors.primary.main};color:#fff;font:inherit;font-weight:600;cursor:pointer;&:disabled{opacity:.55;cursor:not-allowed}`;

const CircuNetAssistant: React.FC = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const contentRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isOpen) contentRef.current?.scrollTo({ top: contentRef.current.scrollHeight, behavior: 'smooth' });
  }, [isOpen, messages]);

  useEffect(() => {
    if (!isOpen) return;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setIsOpen(false);
    };
    window.addEventListener('keydown', closeOnEscape);
    return () => window.removeEventListener('keydown', closeOnEscape);
  }, [isOpen]);

  const ask = (rawQuestion: string) => {
    const question = rawQuestion.trim();
    if (!question) return;
    setMessages((current) => [...current, { role: 'user', text: question }, { role: 'assistant', text: findAnswer(question) }]);
  };

  const submitQuestion = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = event.currentTarget;
    const question = String(new FormData(form).get('question') || '');
    ask(question);
    form.reset();
  };

  return (
    <Root>
      <AnimatePresence>
        {isOpen && (
          <Panel id="circunet-assistant-panel" role="dialog" aria-labelledby="circunet-assistant-title" aria-modal="false"
            initial={{ opacity: 0, y: 12, scale: .98 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 8, scale: .98 }} transition={{ duration: .18 }}>
            <Header>
              <HeaderRow>
                <div><Heading id="circunet-assistant-title">🤖 CircuNet Assistant</Heading><Subtitle>How can I help you?</Subtitle></div>
                <Close type="button" aria-label="Close CircuNet Assistant" onClick={() => setIsOpen(false)}>×</Close>
              </HeaderRow>
            </Header>
            <Content ref={contentRef} aria-live="polite">
              {messages.length > 0 ? (
                <>
                  <Conversation>{messages.map((message, index) => <Bubble key={`${index}-${message.role}`} $role={message.role}>{message.text}</Bubble>)}</Conversation>
                  <Back type="button" onClick={() => setMessages([])}>← Back to questions</Back>
                </>
              ) : (
                <QuestionList aria-label="Frequently asked questions">
                  {helpTopics.slice(0, 7).map((item) => <QuestionButton key={item.question} type="button" onClick={() => ask(item.question)}>{item.question}</QuestionButton>)}
                </QuestionList>
              )}
              <Composer onSubmit={submitQuestion}>
                <TextInput name="question" aria-label="Ask CircuNet Assistant a question" placeholder="Ask a CircuNet question…" autoComplete="off" />
                <Send type="submit">Ask</Send>
              </Composer>
            </Content>
          </Panel>
        )}
      </AnimatePresence>
      <Toggle type="button" aria-expanded={isOpen} aria-controls="circunet-assistant-panel" aria-label={isOpen ? 'Close CircuNet Assistant' : 'Open CircuNet Assistant'} onClick={() => setIsOpen((open) => !open)}>
        💬 CircuNet Assistant
      </Toggle>
    </Root>
  );
};

export default CircuNetAssistant;
