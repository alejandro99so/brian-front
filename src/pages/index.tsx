import { ConnectButton } from "@rainbow-me/rainbowkit";
import type { NextPage } from "next";
import Head from "next/head";
import styles from "../styles/Home.module.css";
import { FormEvent, useEffect, useState } from "react";
import { translate } from "@vitalets/google-translate-api";
import {
  useSendTransaction,
  useAccount,
  useWriteContract,
  useWaitForTransactionReceipt,
} from "wagmi";
import constants from "../../constants.json";

const Home: NextPage = () => {
  const [history, setHistory] = useState([]);
  const [hash, setHash] = useState("0x");
  const [dataSwap, setDataSwap] = useState({ balance: 0, chainId: 0 });
  const [totalTrxs, setTotalTrxs] = useState(0);
  const { sendTransaction } = useSendTransaction();
  const account = useAccount();
  const { writeContract, writeContractAsync } = useWriteContract();
  const result = useWaitForTransactionReceipt({
    hash: hash as `0x${string}`,
    confirmations: 2,
  });

  useEffect(() => {
    if (result.isSuccess && totalTrxs == 1) {
      setTotalTrxs(2);
      const dataWrite = {
        abi: constants.ABISwap,
        address: constants.addressSwap as `0x${string}`,
        functionName: "swapRevert",
        chainId: dataSwap.chainId == 43114 ? 43113 : dataSwap.chainId,
        args: [dataSwap.balance],
      };
      const _hash = writeContractAsync(dataWrite);
      console.log("La transacción finalizó con el hash: ", _hash);
    } else if (result.isSuccess && totalTrxs == 2) {
      setTotalTrxs(3);
      console.log("Termine");
    }
  }, [result]);
  const translateText = async (message: string, languageTo: "en" | "es") => {
    try {
      const { text } = await translate(message, { to: languageTo });
      return text;
    } catch (ex: any) {
      console.log("Error: ", ex.message);
      return message;
    }
  };

  const onSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    try {
      const messages = event.target as HTMLFormElement;
      const _message = (messages[0] as HTMLInputElement).value;
      console.log({ _message });

      const textUser = await translateText(_message, "en");

      const request = await fetch("https://api.brianknows.org/api/v0/agent", {
        method: "POST",
        headers: {
          "X-Brian-Api-Key": String(process.env.NEXT_PUBLIC_BRIAN_API_KEY),
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          prompt: textUser,
          address: account.address,
          messages: history,
          // messages: history == "" ? [] : JSON.parse(history),
        }),
      });

      const response = await request.json();
      const messageError = response.error;
      console.log("Error: ", response.error);
      let message = "";
      if (messageError) {
        console.log("Entre al mensaje");
        message = await translateText(messageError, "es");
        if (history.length == 0)
          setHistory([
            ...response?.conversationHistory,
            { content: messageError, sender: "brian" },
          ]);
        else setHistory(response?.conversationHistory);
      } else {
        message = JSON.stringify(response);
        console.log({ response });
        if (response.result) {
          for (const req of response.result) {
            if (req.action == "transfer") {
              console.log("Transfer token");
              for (const step of req.data.steps!) {
                try {
                  //   const account = privateKeyToAccount(
                  //     `0x${process.env.PRIVATE_KEY}`
                  //   );
                  console.log({
                    to: step.to,
                    value: BigInt(step.value),
                    data: step.data,
                  });
                  sendTransaction({
                    to: step.to,
                    value: BigInt(step.value),
                  });
                  //   const tx = await walletClient.sendTransaction({
                  //     account: account,
                  //     to: step.to,
                  //     value: BigInt(step.value),
                  //     data: step.data,
                  //   });

                  //   console.log(`Transaction for step ${step.chainId} sent:`, tx);
                  //   // await publicClient.waitForTransactionReceipt({ hash: tx }); // Wait for the transaction to be mined
                  //   console.log(`Transaction for step ${step.chainId} confirmed.`);
                } catch (ex: any) {
                  console.log("Fallé en la transacción");
                }
              }
            } else if (req.action == "swap") {
              // USDC
              //"0xB97EF9Ef8734C71904D8002F8b6Bc66Dd9c48a6E"
              //0x2c6d4C5cf10DF74F2201c01aa72a65fD7faD9E63
              if (req.data.steps.length == 1) {
                try {
                  const dataWrite = {
                    abi: constants.ABISwap,
                    address: constants.addressSwap as `0x${string}`,
                    functionName: "swap",
                    chainId:
                      req.data.steps[0].chainId == 43114
                        ? 43113
                        : req.data.steps[0].chainId,
                    value: req.data.steps[0].value,
                  };
                  writeContract(dataWrite);
                } catch (ex: any) {
                  console.log({ error: ex.message });
                }
              } else if (req.data.steps.length == 2) {
                try {
                  const balanceToApprove =
                    req.data.fromAmountUSD *
                    10 ** (req.data.fromToken.decimals * 3);
                  setTotalTrxs(1);
                  setDataSwap({
                    balance: balanceToApprove,
                    chainId: req.data.steps[0].chainId,
                  });
                  const dataApprove = {
                    abi: constants.ABIERC20,
                    address: constants.addressERC20 as `0x${string}`,
                    functionName: "approve",
                    chainId:
                      req.data.steps[0].chainId == 43114
                        ? 43113
                        : req.data.steps[0].chainId,
                    args: [constants.addressSwap, balanceToApprove],
                  };
                  const _hash = await writeContractAsync(dataApprove);
                  setHash(_hash);
                  console.log({ dataApprove });
                } catch (ex: any) {
                  console.log({ error: ex.message });
                }
              }
              // for (const step of req.data.steps!) {
              //   console.log({ step });
              //     if (req.data.steps.length == 1) {
              //       const dataWrite = {
              //         abi: constants.ABISwap,
              //         address: constants.addressSwap as `0x${string}`,
              //         functionName: "swap",
              //         chainId: step.chainId == 43114 ? 43113 : step.chainId,
              //         value: step.value,
              //       };
              //       writeContract(dataWrite);
              //     } else {

              //     }
              //   } catch (ex: any) {
              //     console.log({ error: ex.message });
              //   }
              // }
            }
          }
        }
      }
    } catch (error) {
      console.error(error);
    }
  };

  useEffect(() => {
    console.log({ history });
  }, [history]);

  return (
    <div className={styles.container}>
      <Head>
        <title>RainbowKit App</title>
        <meta
          content="Generated by @rainbow-me/create-rainbowkit"
          name="description"
        />
        <link href="/favicon.ico" rel="icon" />
      </Head>

      <main className={styles.main}>
        <ConnectButton />
        <h1>Bienvenido al futuro con Agentes AI </h1>

        <h2>Chat</h2>

        {history.map((el: { content: string; sender: string }) => (
          <div
            className={`${styles.message} ${
              el.sender == "brian" ? styles.message_left : styles.message_rigth
            }`}
          >
            {el.content}
          </div>
        ))}

        <form onSubmit={onSubmit}>
          <input type="text" name="name" />
          <button type="submit">Enviar Mensaje</button>
        </form>
      </main>

      <footer className={styles.footer}>
        <a href="https://rainbow.me" rel="noopener noreferrer" target="_blank">
          Made with ❤️ by your frens at 🌈
        </a>
      </footer>
    </div>
  );
};

export default Home;
