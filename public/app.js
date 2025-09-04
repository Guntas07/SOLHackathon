
    // Solana SPL Token Mints
    const STABLECOIN_MINTS = {
      "USDC": "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v",
      "USDT": "Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB"
    };
    const SOLANA_RPC_URL = solanaWeb3.clusterApiUrl('mainnet-beta');

    // DOM refs
    const paymentRequestForm  = document.getElementById('paymentRequestForm');
    const paymentDetailsDiv   = document.getElementById('paymentDetails');
    const paymentDetailsTitle = document.getElementById('paymentDetailsTitle');
    const qrCodeCanvas        = document.getElementById('qrCodeCanvas');
    const qrCodeErrorEl       = document.getElementById('qrCodeError');
    const walletAddressInput  = document.getElementById('walletAddress');
    const walletAddressError  = document.getElementById('walletAddressError');
    const amountInput         = document.getElementById('amount');
    const amountError         = document.getElementById('amountError');
    const stablecoinSelect    = document.getElementById('stablecoin');
    const descriptionInput    = document.getElementById('description');
    const messageInput        = document.getElementById('message');
    const connectWalletButton = document.getElementById('connectWalletButton');
    const payWithWalletButton = document.getElementById('payWithWalletButton');
    const createNewRequestButton = document.getElementById('createNewRequestButton');
    const sharingOptionsDiv   = document.getElementById('sharingOptions');
    const notificationModal   = document.getElementById('notificationModal');
    const notificationMessage = document.getElementById('notificationMessage');
    const modalCloseButton    = document.querySelector('.modal-close-button');

    let isPayerView   = false,
        payerPublicKey= null,
        solanaConnection = null;

    // modal helpers
    function showModal(msg, sticky=false) {
      notificationMessage.innerHTML = msg;
      notificationModal.style.display = 'block';
      if (!sticky) setTimeout(closeModal, 4000);
    }
    function closeModal() {
      notificationModal.style.display = 'none';
    }
    window.onclick = e => { if (e.target===notificationModal) closeModal(); };
    if (modalCloseButton) modalCloseButton.onclick = closeModal;

    // wallet validation
    function validateWalletRealtime() {
      const v = walletAddressInput.value;
      if (!v && !isPayerView) {
        walletAddressError.style.display='none';
        walletAddressInput.classList.remove('input-error');
        return true;
      }
      if (!/^[1-9A-HJ-NP-Za-km-z]{0,44}$/.test(v)) {
        walletAddressError.textContent='Invalid Base58.';
        walletAddressError.style.display='block';
        walletAddressInput.classList.add('input-error');
        return false;
      }
      if (v.length && (v.length<32||v.length>44)) {
        walletAddressError.textContent='32–44 chars.';
        walletAddressError.style.display='block';
        walletAddressInput.classList.add('input-error');
        return false;
      }
      walletAddressError.style.display='none';
      walletAddressInput.classList.remove('input-error');
      return true;
    }
    function isWalletValid(w){ return /^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(w); }
    walletAddressInput.addEventListener('input', validateWalletRealtime);

    // amount validation
    function validateAmount(){
      const a = parseFloat(amountInput.value);
      if (isNaN(a)||a<=0){
        amountError.textContent='Must be positive.';
        amountError.style.display='block';
        amountInput.classList.add('input-error');
        return false;
      }
      if (amountInput.value.includes('.') && amountInput.value.split('.')[1].length>6){
        amountError.textContent='Max 6 decimals.';
        amountError.style.display='block';
        amountInput.classList.add('input-error');
        return false;
      }
      amountError.style.display='none';
      amountInput.classList.remove('input-error');
      return true;
    }
    amountInput.addEventListener('input', validateAmount);

    // connect requestor
    async function connectRequestorWallet(){
      if (!window.solana||!window.solana.connect){
        showModal("Install a Solana wallet first.",true);
        return;
      }
      try {
        const resp = await window.solana.connect();
        const pk = resp.publicKey.toString();
        walletAddressInput.value=pk;
        validateWalletRealtime();
        showModal(`Connected: ${pk.substr(0,6)}…${pk.substr(-6)}`);
      } catch(e){
        console.error(e);
        showModal("Connection failed.",true);
      }
    }
    connectWalletButton.addEventListener('click', connectRequestorWallet);

    // on load: check URL for payer view
    function initializeSolanaConnection(){
      if (!solanaConnection){
        solanaConnection=new solanaWeb3.Connection(SOLANA_RPC_URL,'confirmed');
      }
    }
    function loadFromURLParams(){
      const p=new URLSearchParams(window.location.search);
      const w=p.get('wallet'), a=p.get('amount'),
            t=p.get('token'), l=p.get('label'), m=p.get('message');
      if (w&&a&&t&&l){
        isPayerView=true;
        initializeSolanaConnection();
        walletAddressInput.value=w;
        amountInput.value=a;
        for(const s in STABLECOIN_MINTS){
          if(STABLECOIN_MINTS[s]===t){ stablecoinSelect.value=s; break; }
        }
        descriptionInput.value=decodeURIComponent(l);
        if(m) messageInput.value=decodeURIComponent(m);
        generatePaymentRequest(true);
      }
    }
    window.onload = () => {
      if(!window.QRious){
        showModal("QR library not loaded.",true);
        qrCodeErrorEl.textContent="QR unavailable."; qrCodeErrorEl.style.display='block';
      }
      if(!window.solanaWeb3){
        showModal("Solana Web3 failed to load.",true);
      }
      loadFromURLParams();
    };

    // form submit
    paymentRequestForm.addEventListener('submit', e=>{
      e.preventDefault();
      generatePaymentRequest(false);
    });

    async function generatePaymentRequest(isFromURL=false){
      const rec=walletAddressInput.value.trim(),
            amt=amountInput.value,
            sym=stablecoinSelect.value,
            desc=descriptionInput.value.trim(),
            msg=messageInput.value.trim();
      let ok=true;
      if(!isWalletValid(rec)){
        walletAddressError.textContent='Invalid wallet.';
        walletAddressError.style.display='block';
        walletAddressInput.classList.add('input-error');
        ok=false;
      } else {
        walletAddressError.style.display='none';
        walletAddressInput.classList.remove('input-error');
      }
      if(!validateAmount()) ok=false;
      if(!desc && !isPayerView){
        showModal("Label required.",true);
        ok=false;
      }
      if(!ok && !isFromURL){
        showModal("Fix errors.",true);
        return;
      }
      const mint=STABLECOIN_MINTS[sym];
      let payUrl=`solana:${rec}?amount=${amt}&spl-token=${mint}&label=${encodeURIComponent(desc)}`;
      if(msg) payUrl+=`&message=${encodeURIComponent(msg)}`;

      document.getElementById('displayWallet').textContent=rec;
      document.getElementById('displayAmount').textContent=
        `${parseFloat(amt).toLocaleString(undefined,{minimumFractionDigits:2,maximumFractionDigits:6})} ${sym}`;
      document.getElementById('displayToken').textContent=
        `${sym} (${mint.substr(0,4)}…${mint.substr(-4)})`;
      document.getElementById('displayDescription').textContent=desc;
      const msgCont=document.getElementById('displayMessageContainer'),
            msgEl=document.getElementById('displayMessage');
      if(msg){ msgEl.textContent=msg; msgCont.style.display='block'; }
      else msgCont.style.display='none';

      document.getElementById('solanaPayUrl').value=payUrl;
      document.getElementById('walletAddressCopy').value=rec;

      // QR generation
      qrCodeErrorEl.style.display='none';
      if(window.QRious){
        try {
          new QRious({
            element: qrCodeCanvas,
            value: payUrl,
            size: 256,
            padding: 8,
            level: 'H',
            background: '#FFFFFF',
            foreground: '#000000'  // solid black modules
          });
          qrCodeCanvas.style.display='block';
        } catch(e){
          console.error(e);
          qrCodeCanvas.style.display='none';
          qrCodeErrorEl.textContent="Failed to generate QR.";
          qrCodeErrorEl.style.display='block';
          if(!isPayerView) showModal("Could not generate QR.",true);
        }
      } else {
        qrCodeCanvas.style.display='none';
        qrCodeErrorEl.textContent="QR lib not loaded.";
        qrCodeErrorEl.style.display='block';
      }

      // share link
      const params=new URLSearchParams({wallet:rec,amount:amt,token:mint,label:desc});
      if(msg) params.set('message',msg);
      document.getElementById('shareableLink').value=
        `${window.location.origin}${window.location.pathname}?${params.toString()}`;

      // UI toggle
      paymentRequestForm.style.display='none';
      paymentDetailsDiv.style.display='block';

      if(isPayerView){
        paymentDetailsTitle.textContent="Confirm & Pay";
        [walletAddressInput,amountInput,stablecoinSelect,descriptionInput,messageInput]
          .forEach(i=>i.disabled=true);
        connectWalletButton.style.display='none';
        payWithWalletButton.style.display='block';
        payWithWalletButton.textContent = payerPublicKey?'Confirm & Pay':'Connect Wallet & Pay';
        payWithWalletButton.onclick = connectAndExecutePayment;
        sharingOptionsDiv.style.display='none';
        createNewRequestButton.textContent='Back to Create Request';
      } else {
        paymentDetailsTitle.textContent="Payment Request Generated";
        payWithWalletButton.style.display='none';
        sharingOptionsDiv.style.display='block';
        createNewRequestButton.textContent='Create New Request';
      }
    }

    // payer: connect & send
    async function connectAndExecutePayment(){
      if(!window.solana||!window.solana.connect){
        showModal("Wallet not detected.",true);
        return;
      }
      initializeSolanaConnection();
      try {
        if(!window.solana.isConnected||!payerPublicKey){
          showModal("Connecting wallet...",true);
          const resp=await window.solana.connect({onlyIfTrusted:false});
          payerPublicKey=resp.publicKey;
          showModal(`Connected: ${payerPublicKey.toBase58().substr(0,6)}…`,false);
        }
        await processPaymentTransaction();
      } catch(err){
        console.error(err);
        showModal(`Payment failed: ${err.message||err}`,true);
        payerPublicKey=null;
      }
    }

    async function processPaymentTransaction(){
      const recAddr=walletAddressInput.value;
      const amtStr=amountInput.value;
      const sym=stablecoinSelect.value;
      const mint=STABLECOIN_MINTS[sym];
      if(!recAddr||!amtStr||!mint){
        showModal("Incomplete payment details.",true);
        return;
      }
      const amt=parseFloat(amtStr);
      payWithWalletButton.disabled=true;
      payWithWalletButton.textContent='Processing...';
      showModal("Preparing transaction…",true);

      try {
        const recipientPK=new solanaWeb3.PublicKey(recAddr),
              mintPK=new solanaWeb3.PublicKey(mint);
        let decimals=6;
        try {
          const info=await solanaConnection.getParsedAccountInfo(mintPK);
          if(info.value?.data?.parsed?.info?.decimals!=null)
            decimals=info.value.data.parsed.info.decimals;
        } catch{}
        const amountUnits=Math.round(amt*Math.pow(10,decimals));
        const payerTokenAddr    = await solanaWeb3.getAssociatedTokenAddress(mintPK,payerPublicKey);
        const recipientTokenAddr= await solanaWeb3.getAssociatedTokenAddress(mintPK,recipientPK);
        const tx=new solanaWeb3.Transaction();
        tx.add(solanaWeb3.createTransferInstruction(
          payerTokenAddr, recipientTokenAddr, payerPublicKey, amountUnits
        ));
        tx.feePayer=payerPublicKey;
        const latest=await solanaConnection.getLatestBlockhash();
        tx.recentBlockhash=latest.blockhash;

        const signed=await window.solana.signTransaction(tx);
        const sig=await solanaConnection.sendRawTransaction(signed.serialize());
        showModal(`Submitted! Sig: ${sig.substr(0,10)}…`,true);
        const conf=await solanaConnection.confirmTransaction({
          signature: sig,
          blockhash: tx.recentBlockhash,
          lastValidBlockHeight: latest.lastValidBlockHeight
        },'confirmed');
        if(conf.value.err) throw new Error(JSON.stringify(conf.value.err));
        showModal(
          `Success! <a href="https://solscan.io/tx/${sig}?cluster=mainnet-beta" target="_blank"
            class="text-solana-green hover:underline">
            View on Solscan
          </a>`,true
        );
        payWithWalletButton.textContent='Payment Sent!';
      } catch(error){
        console.error(error);
        showModal(`Error: ${error.message||error}`,true);
        payWithWalletButton.disabled=false;
        payWithWalletButton.textContent='Try Payment Again';
      }
    }

    // clipboard
    function copyToClipboard(id, tipId){
      const inp=document.getElementById(id);
      inp.select();
      inp.setSelectionRange(0,99999);
      navigator.clipboard.writeText(inp.value)
        .then(()=>showModal('Copied!'))
        .catch(()=>showModal('Copy failed.',true));
    }

    // reset
    function resetForm(){
      paymentRequestForm.reset();
      [walletAddressError,amountError].forEach(e=>e.style.display='none');
      [walletAddressInput,amountInput].forEach(i=>i.classList.remove('input-error'));
      [walletAddressInput,amountInput,stablecoinSelect,descriptionInput,messageInput]
        .forEach(i=>i.disabled=false);
      paymentDetailsDiv.style.display='none';
      paymentRequestForm.style.display='block';
      connectWalletButton.style.display='inline-flex';
      payWithWalletButton.style.display='none';
      payWithWalletButton.disabled=false;
      payWithWalletButton.textContent='Connect Wallet & Pay';
      sharingOptionsDiv.style.display='block';
      createNewRequestButton.textContent='Create New Request';
      isPayerView=false; payerPublicKey=null;
      window.history.pushState({},document.title,window.location.pathname);
      walletAddressInput.focus();
    }
  