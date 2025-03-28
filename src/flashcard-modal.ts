import { Modal, App, MarkdownRenderer, Notice } from "obsidian";
import type SRPlugin from "./main";
import { Card } from "./main";
import { CLOZE_SCHEDULING_EXTRACTOR } from "./constants";

enum UserResponse {
    ShowAnswer,
    ReviewHard,
    ReviewGood,
    ReviewEasy,
    ResetCardProgress,
    Skip,
}

enum Mode {
    Front,
    Back,
    Closed,
}

export class FlashcardModal extends Modal {
    private plugin: SRPlugin;
    private answerBtn: HTMLElement;
    private flashcardView: HTMLElement;
    private hardBtn: HTMLElement;
    private goodBtn: HTMLElement;
    private easyBtn: HTMLElement;
    private responseDiv: HTMLElement;
    private fileLinkView: HTMLElement;
    private resetLinkView: HTMLElement;
    private contextView: HTMLElement;
    private currentCard: Card;
    private mode: Mode;

    constructor(app: App, plugin: SRPlugin) {
        super(app);

        this.plugin = plugin;

        this.titleEl.setText("Queue");
        this.modalEl.style.height = "80%";
        this.modalEl.style.width = "40%";

        this.contentEl.style.position = "relative";
        this.contentEl.style.height = "92%";

        this.fileLinkView = createDiv("sr-link");
        this.fileLinkView.setText("Open file");
        this.fileLinkView.addEventListener("click", (_) => {
            this.close();
            this.plugin.app.workspace.activeLeaf.openFile(
                this.currentCard.note
            );
        });
        this.contentEl.appendChild(this.fileLinkView);

        this.resetLinkView = createDiv("sr-link");
        this.resetLinkView.setText("Reset card's progress");
        this.resetLinkView.addEventListener("click", (_) => {
            this.processResponse(UserResponse.ResetCardProgress);
        });
        this.resetLinkView.style.float = "right";
        this.contentEl.appendChild(this.resetLinkView);

        this.contextView = document.createElement("div");
        this.contextView.setAttribute("id", "sr-context");
        this.contentEl.appendChild(this.contextView);

        this.flashcardView = document.createElement("div");
        this.contentEl.appendChild(this.flashcardView);

        this.responseDiv = createDiv("sr-response");

        this.hardBtn = document.createElement("button");
        this.hardBtn.setAttribute("id", "sr-hard-btn");
        this.hardBtn.setText("Hard");
        this.hardBtn.addEventListener("click", (_) => {
            this.processResponse(UserResponse.ReviewHard);
        });
        this.responseDiv.appendChild(this.hardBtn);

        this.goodBtn = document.createElement("button");
        this.goodBtn.setAttribute("id", "sr-good-btn");
        this.goodBtn.setText("Good");
        this.goodBtn.addEventListener("click", (_) => {
            this.processResponse(UserResponse.ReviewGood);
        });
        this.responseDiv.appendChild(this.goodBtn);

        this.easyBtn = document.createElement("button");
        this.easyBtn.setAttribute("id", "sr-easy-btn");
        this.easyBtn.setText("Easy");
        this.easyBtn.addEventListener("click", (_) => {
            this.processResponse(UserResponse.ReviewEasy);
        });
        this.responseDiv.appendChild(this.easyBtn);
        this.responseDiv.style.display = "none";

        this.contentEl.appendChild(this.responseDiv);

        this.answerBtn = document.createElement("div");
        this.answerBtn.setAttribute("id", "sr-show-answer");
        this.answerBtn.setText("Show Answer");
        this.answerBtn.addEventListener("click", (_) => {
            this.processResponse(UserResponse.ShowAnswer);
        });
        this.contentEl.appendChild(this.answerBtn);

        document.body.onkeypress = (e) => {
            if (this.mode != Mode.Closed && e.code == "KeyS") {
                this.processResponse(UserResponse.Skip);
            } else if (
                this.mode == Mode.Front &&
                (e.code == "Space" || e.code == "Enter")
            )
                this.processResponse(UserResponse.ShowAnswer);
            else if (this.mode == Mode.Back) {
                if (e.code == "Numpad1" || e.code == "Digit1")
                    this.processResponse(UserResponse.ReviewHard);
                else if (e.code == "Numpad2" || e.code == "Digit2")
                    this.processResponse(UserResponse.ReviewGood);
                else if (e.code == "Numpad3" || e.code == "Digit3")
                    this.processResponse(UserResponse.ReviewEasy);
                else if (e.code == "Numpad0" || e.code == "Digit0")
                    this.processResponse(UserResponse.ResetCardProgress);
            }
        };
    }

    onOpen() {
        this.nextCard();
    }

    onClose() {
        this.mode = Mode.Closed;
    }

    nextCard() {
        this.responseDiv.style.display = "none";
        this.resetLinkView.style.display = "none";
        let count =
            this.plugin.newFlashcards.length + this.plugin.dueFlashcards.length;
        this.titleEl.setText(`Queue - ${count}`);

        if (count == 0) {
            this.answerBtn.style.display = "none";
            this.fileLinkView.innerHTML = "";
            this.resetLinkView.innerHTML = "";
            this.contextView.innerHTML = "";
            this.flashcardView.innerHTML =
                "<h3 style='text-align: center; margin-top: 45%;'>You're done for the day :D.</h3>";
            return;
        }

        this.answerBtn.style.display = "initial";
        this.flashcardView.innerHTML = "";
        this.mode = Mode.Front;

        if (this.plugin.dueFlashcards.length > 0) {
            this.currentCard = this.plugin.dueFlashcards[0];
            MarkdownRenderer.renderMarkdown(
                this.currentCard.front,
                this.flashcardView,
                this.currentCard.note.path,
                this.plugin
            );

            let hardInterval = this.nextState(
                UserResponse.ReviewHard,
                this.currentCard.interval,
                this.currentCard.ease
            ).interval;
            let goodInterval = this.nextState(
                UserResponse.ReviewGood,
                this.currentCard.interval,
                this.currentCard.ease
            ).interval;
            let easyInterval = this.nextState(
                UserResponse.ReviewEasy,
                this.currentCard.interval,
                this.currentCard.ease
            ).interval;

            this.hardBtn.setText(`Hard - ${hardInterval} day(s)`);
            this.goodBtn.setText(`Good - ${goodInterval} day(s)`);
            this.easyBtn.setText(`Easy - ${easyInterval} day(s)`);
        } else if (this.plugin.newFlashcards.length > 0) {
            this.currentCard = this.plugin.newFlashcards[0];
            MarkdownRenderer.renderMarkdown(
                this.currentCard.front,
                this.flashcardView,
                this.currentCard.note.path,
                this.plugin
            );
            this.hardBtn.setText("Hard - 1.0 day(s)");
            this.goodBtn.setText("Good - 2.5 day(s)");
            this.easyBtn.setText("Easy - 3.5 day(s)");
        }

        this.contextView.setText(this.currentCard.context);
    }

    async processResponse(response: UserResponse) {
        if (response == UserResponse.ShowAnswer) {
            this.mode = Mode.Back;

            this.answerBtn.style.display = "none";
            this.responseDiv.style.display = "grid";

            if (this.currentCard.isDue)
                this.resetLinkView.style.display = "inline-block";

            if (!this.currentCard.isCloze) {
                let hr = document.createElement("hr");
                hr.setAttribute("id", "sr-hr-card-divide");
                this.flashcardView.appendChild(hr);
            } else this.flashcardView.innerHTML = "";

            MarkdownRenderer.renderMarkdown(
                this.currentCard.back,
                this.flashcardView,
                this.currentCard.note.path,
                this.plugin
            );
        } else if (
            response == UserResponse.ReviewHard ||
            response == UserResponse.ReviewGood ||
            response == UserResponse.ReviewEasy ||
            response == UserResponse.ResetCardProgress
        ) {
            let intervalOuter, easeOuter, due;

            if (response != UserResponse.ResetCardProgress) {
                // scheduled card
                if (this.currentCard.isDue) {
                    this.plugin.dueFlashcards.splice(0, 1);
                    let { interval, ease } = this.nextState(
                        response,
                        this.currentCard.interval,
                        this.currentCard.ease
                    );
                    // don't look too closely lol
                    intervalOuter = interval;
                    easeOuter = ease;
                } else {
                    let { interval, ease } = this.nextState(
                        response,
                        1,
                        this.plugin.data.settings.baseEase
                    );
                    this.plugin.newFlashcards.splice(0, 1);
                    // don't look too closely lol
                    intervalOuter = interval;
                    easeOuter = ease;
                }

                // fuzz
                if (intervalOuter >= 8) {
                    let fuzz = [-0.05 * intervalOuter, 0, 0.05 * intervalOuter];
                    intervalOuter +=
                        fuzz[Math.floor(Math.random() * fuzz.length)];
                }
                intervalOuter = Math.round(intervalOuter);
                due = window.moment(
                    Date.now() + intervalOuter * 24 * 3600 * 1000
                );
            } else {
                intervalOuter = 1.0;
                easeOuter = this.plugin.data.settings.baseEase;
                this.plugin.dueFlashcards.splice(0, 1);
                this.plugin.dueFlashcards.push(this.currentCard);
                due = window.moment(Date.now());
                new Notice("Card's progress has been reset");
            }

            let dueString = due.format("DD-MM-YYYY");

            let fileText = await this.app.vault.read(this.currentCard.note);
            let replacementRegex = new RegExp(
                this.currentCard.match[0].replace(
                    /[.*+?^${}()|[\]\\]/g,
                    "\\$&"
                ), // escape string
                "gm"
            );

            if (this.currentCard.isCloze) {
                let cardText = this.currentCard.match[0];

                let schedIdx = cardText.lastIndexOf("<!--SR:");
                if (schedIdx == -1) {
                    // first time adding scheduling information to flashcard
                    cardText = `${cardText}\n<!--SR:!${dueString},${intervalOuter},${easeOuter}-->`;
                } else {
                    let scheduling = [
                        ...cardText.matchAll(CLOZE_SCHEDULING_EXTRACTOR),
                    ];

                    let deletionSched = [
                        "0",
                        dueString,
                        `${intervalOuter}`,
                        `${easeOuter}`,
                    ];
                    if (this.currentCard.isDue)
                        scheduling[
                            this.currentCard.clozeDeletionIdx
                        ] = deletionSched;
                    else scheduling.push(deletionSched);

                    cardText = cardText.replace(/<!--SR:.+-->/gm, "");
                    cardText += "<!--SR:";
                    for (let i = 0; i < scheduling.length; i++)
                        cardText += `!${scheduling[i][1]},${scheduling[i][2]},${scheduling[i][3]}`;
                    cardText += "-->";
                }

                fileText = fileText.replace(replacementRegex, cardText);
                for (let relatedCard of this.currentCard.relatedCards)
                    relatedCard.match[0] = cardText;
                if (this.plugin.data.settings.buryRelatedCards)
                    this.buryRelatedCards(this.currentCard.relatedCards);
            } else {
                if (this.currentCard.isSingleLine) {
                    let sep = this.plugin.data.settings
                        .singleLineCommentOnSameLine
                        ? " "
                        : "\n";

                    fileText = fileText.replace(
                        replacementRegex,
                        `${this.currentCard.front}::${this.currentCard.back}${sep}<!--SR:${dueString},${intervalOuter},${easeOuter}-->`
                    );
                } else {
                    fileText = fileText.replace(
                        replacementRegex,
                        `${this.currentCard.front}\n?\n${this.currentCard.back}\n<!--SR:${dueString},${intervalOuter},${easeOuter}-->`
                    );
                }
            }

            await this.app.vault.modify(this.currentCard.note, fileText);
            this.nextCard();
        } else if (response == UserResponse.Skip) {
            if (this.currentCard.isDue) this.plugin.dueFlashcards.splice(0, 1);
            else this.plugin.newFlashcards.splice(0, 1);
            if (this.currentCard.isCloze)
                this.buryRelatedCards(this.currentCard.relatedCards);
            this.nextCard();
        }
    }

    nextState(response: UserResponse, interval: number, ease: number) {
        if (response != UserResponse.ReviewGood) {
            ease =
                response == UserResponse.ReviewEasy
                    ? ease + 20
                    : Math.max(130, ease - 20);
        }

        if (response == UserResponse.ReviewHard)
            interval = Math.max(
                1,
                interval * this.plugin.data.settings.lapsesIntervalChange
            );
        else if (response == UserResponse.ReviewGood)
            interval = (interval * ease) / 100;
        else
            interval =
                (this.plugin.data.settings.easyBonus * interval * ease) / 100;

        return { ease, interval: Math.round(interval * 10) / 10 };
    }

    buryRelatedCards(arr: Card[]) {
        for (let relatedCard of arr) {
            let dueIdx = this.plugin.dueFlashcards.indexOf(relatedCard);
            let newIdx = this.plugin.newFlashcards.indexOf(relatedCard);

            if (dueIdx != -1) this.plugin.dueFlashcards.splice(dueIdx, 1);
            else if (newIdx != -1) this.plugin.newFlashcards.splice(newIdx, 1);
        }
    }
}
